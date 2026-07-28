#!/usr/bin/env bash
# Onboarding de um número novo na WhatsApp Cloud API, passo a passo.
#
# Cada etapa é um comando separado de propósito: pedir código tem rate limit
# agressivo na Meta e tentativas perdidas renovam o cooldown (ver
# docs/meta/info.md). Nunca encadeie as etapas automaticamente.
#
#   ./scripts/meta-numero.sh status [phone-number-id]
#   ./scripts/meta-numero.sh listar
#   ./scripts/meta-numero.sh add <cc> <numero> "<nome-exibicao>"
#   ./scripts/meta-numero.sh pedir-codigo <phone-number-id> [SMS|VOICE]
#   ./scripts/meta-numero.sh verificar <phone-number-id> <codigo>
#   ./scripts/meta-numero.sh registrar <phone-number-id> [pin]

set -euo pipefail

cd "$(dirname "$0")/.."
set -a; . ./.env; set +a

API="https://graph.facebook.com/v25.0"
WABA_ID="${WABA_ID:-368840660673690}"

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
    req GET "${2:?informe o phone-number-id}?fields=display_phone_number,verified_name,platform_type,status,code_verification_status,quality_rating,name_status"
    ;;

  add)
    # NÃO FUNCIONA para este app: POST /{waba}/phone_numbers exige que o Business dono
    # do app seja Business Solution Provider. Testado 27/07/2026 → 200000/3095008, e a
    # causa real aparece como (#10) em qualquer campo restrito da WABA. Adicione o
    # número pelo WhatsApp Manager e volte aqui a partir de `listar`.
    # Mantido só para documentar a tentativa. Ver docs/meta/info.md.
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
    req POST "${2:?informe o phone-number-id}/register" \
      -d "{\"messaging_product\":\"whatsapp\",\"pin\":\"${3:-000000}\"}"
    ;;

  *)
    sed -n '2,14p' "$0"
    exit 1
    ;;
esac
