#!/usr/bin/env bash
# Onboarding de um número novo na WhatsApp Cloud API, passo a passo.
#
# Cada etapa é um comando separado de propósito: pedir código tem rate limit
# agressivo na Meta e tentativas perdidas renovam o cooldown. Nunca encadeie as
# etapas automaticamente. Guia completo: docs/meta/playbook-numero-novo.md
#
# Lê WABA_ID, PHONE_NUMBER_ID e WHATSAPP_2FA_PIN do .env (ver .env.sample).
#
#   ./scripts/meta-numero.sh listar
#   ./scripts/meta-numero.sh status [phone-number-id]        # default: PHONE_NUMBER_ID
#   ./scripts/meta-numero.sh add <cc> <numero> "<nome>"      # inoperante, ver abaixo
#   ./scripts/meta-numero.sh pedir-codigo <phone-number-id> [SMS|VOICE]
#   ./scripts/meta-numero.sh verificar <phone-number-id> <codigo>
#   ./scripts/meta-numero.sh registrar [phone-number-id] [pin]  # defaults: .env

set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

API="https://graph.facebook.com/v25.0"
# Vem do .env (ver .env.sample). Sobrescreva na chamada para agir noutra WABA:
#   WABA_ID=<outro-id> ./scripts/meta-numero.sh listar
: "${WABA_ID:?defina WABA_ID no .env — ver .env.sample e docs/meta/referencia.md}"

req() {
  local method=$1 path=$2; shift 2
  curl -sS -X "$method" "$API/$path" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    "$@" | python3 -m json.tool
}

case "${1:-}" in
  listar)
    req GET "$WABA_ID/phone_numbers?fields=display_phone_number,verified_name,platform_type,status,code_verification_status,quality_rating"
    ;;

  status)
    req GET "${2:-${PHONE_NUMBER_ID:?informe o phone-number-id ou defina PHONE_NUMBER_ID no .env}}?fields=display_phone_number,verified_name,platform_type,status,code_verification_status,quality_rating,name_status"
    ;;

  add)
    # NÃO FUNCIONA para este app: POST /{waba}/phone_numbers exige que o Business dono
    # do app seja Business Solution Provider. Testado 27/07/2026 → 200000/3095008, e a
    # causa real aparece como (#10) em qualquer campo restrito da WABA. Adicione o
    # número pelo WhatsApp Manager e volte aqui a partir de `listar`.
    # Mantido só para documentar a tentativa. Ver docs/meta/playbook-numero-novo.md.
    #
    # cc = código do país sem '+' (Brasil = 55); numero = DDD + linha, sem espaços.
    req POST "$WABA_ID/phone_numbers" -d "$(python3 -c '
import json,sys; print(json.dumps({"cc":sys.argv[1],"phone_number":sys.argv[2],"verified_name":sys.argv[3]}))' \
      "${2:?cc}" "${3:?numero}" "${4:?nome de exibicao}")"
    ;;

  pedir-codigo)
    # UMA tentativa por vez. Se falhar, leia o erro e espere — não repita.
    req POST "${2:?informe o phone-number-id}/request_code" \
      -d "{\"code_method\":\"${3:-SMS}\",\"language\":\"pt_BR\"}"
    ;;

  verificar)
    req POST "${2:?informe o phone-number-id}/verify_code" \
      -d "{\"code\":\"${3:?informe o codigo recebido}\"}"
    ;;

  registrar)
    # PIN vem do .env por padrão — nunca passe em linha de comando sem necessidade,
    # o histórico do shell é um vazamento tão real quanto um commit.
    req POST "${2:-${PHONE_NUMBER_ID:?informe o phone-number-id ou defina PHONE_NUMBER_ID no .env}}/register" \
      -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"${3:-${WHATSAPP_2FA_PIN:?defina WHATSAPP_2FA_PIN no .env}}\"}"
    ;;

  *)
    sed -n '2,17p' "$0"
    exit 1
    ;;
esac
