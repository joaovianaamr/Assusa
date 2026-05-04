class SicoobCertificateError(Exception):
    """Erro ao ler PKCS#12 ou gerar ficheiros PEM (paridade com CertificateTools PHP)."""


class SicoobConfigError(Exception):
    """Configuração em falta ou inválida para o cliente Sicoob."""
