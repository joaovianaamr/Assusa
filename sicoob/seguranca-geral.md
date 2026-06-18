Padrões de segurança

As APIs do Sicoob aplicam padrões de segurança necessários para transações bancárias. Veja a seguir uma visão geral de nossos padrões de segurança.

Autorização – o OAuth 2.0

As APIs do Sicoob utilizam o padrão de autorização OAuth 2.0 client credentials para autenticação e autorização, especificado na RFC 6749. Através do padrão OAuth, o cliente não fornece seus aplicativos fora do ambiente Sicoob, de forma que os aplicativos de terceiros não terão acesso às informações de autenticação.

O fluxo de concessão de credenciais de cliente do OAuth 2.0 permite que o aplicativo use as próprias credenciais para se autenticar na API. As permissões são concedidas pelo aplicativo através da geração de um ID do cliente (Client ID) e certificado digital. Quando o aplicativo apresenta um token para acesso a uma API, esta impõe que o próprio aplicativo tenha autorização para executar uma ação, já que não há nenhum usuário envolvido na autenticação.

Protocolo HTTPS

O HTTPS é um protocolo para comunicação seguro que vem sendo amplamente utilizado na internet há muitos anos. As APIs do Sicoob utilizam o protocolo HTTPS para as comunicações de clientes e nossos serviços. Com isso, a troca de informações é segura, pois é feita por meio de criptografia de dados de ponta a ponta. Isso garante a privacidade dos dados sob um protocolo seguro.

Protocolo TLS e o mTLS (TLS mútuo)

O TLS é utilizado para as comunicações de nossas APIs promovendo a criptografia que garante a confidencialidade e integridade da conexão, e também garante autenticação quando certificados digitais são apresentados pelo cliente e/ou servidor. Algumas de nossas APIs utilizam o TLS mútuo (mTLS - da RF8705).

Certificados Digitais

As APIs do Sicoob cujo fluxo de autenticação é client credentials, utilizam certificados digitais garantindo mais proteção à comunicação, autenticação e integridade na utilização de nossos serviços. Os certificados digitais devem ser emitidos por ACs (Autorizações Certificadoras) ICP Brasil, do tipo A1 e-CNPJ ou e-CPF emitido para o cooperado, obedecendo ao padrão internacional x.509. Quando um certificado é assinado por uma autoridade de certificação confiável, quem possuir o certificado pode contar com a chave pública que ele contém para estabelecer uma comunicação segura com a outra parte. O padrão internacional x.509 provê a especificação para certificados de chave pública e proporciona uma solução de segurança mais completa, assegurando a identidade de todas as partes envolvidas em uma integração.