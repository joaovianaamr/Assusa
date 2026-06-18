Rate Limit: Limite de requisições por segundo

Para assegurar uma experiência de alta qualidade e a estabilidade dos nossos serviços, introduzimos um limite de Requisições Por Segundo (Rate Limit) nas nossas APIs. Esta nova medida visa proporcionar um acesso justo e eficiente aos nossos recursos tecnológicos, garantindo desempenho consistente e confiável para todos os usuários e parceiros.

Ao superar o limite estipulado, as requisições adicionais serão bloqueadas temporariamente, gerando um erro de código HTTP 429 - Too Many Requests que indica "Muitas Requisições" em um determinado período, isto é, por segundo. Isso é parte do nosso esforço para prevenir sobrecargas no sistema, mantendo-o rápido e acessível a todos.

Aos desenvolvedores, recomendamos a adoção de práticas eficientes de gerenciamento das requisições às APIs, como o uso de filas e estratégias de reenvio com espera, para adequar o uso ao limite e evitar possíveis interrupções.

Entendemos que algumas aplicações podem requerer um volume maior de transações. Para esses casos, caso necessite de um limite maior, o integrador pode entrar em contato diretamente com nosso suporte, solicitando o ajuste. Estamos abertos para avaliar cada situação e fornecer soluções que atendam às necessidades específicas de sua integração.

Para mais informações sobre como se adaptar ao Rate Limit e para solicitações de aumento, por favor, entre em contato através dos canais disponíveis em nossa página de suporte. Nosso time está pronto para auxiliar, oferecendo suporte técnico e orientações detalhadas para garantir a eficiência e o sucesso de suas aplicações.

A baixo a lista de APIs e seus respectivos limites de requisições por segundo.

    Cobrança Bancária:

    Endpoints de Movimentações (Solicitar, Consultar e Download).
    10 por segundo

    GET Consultar boleto.
    20 por segundo

    GET Pagadores, Emissão de segunda via, Baixa de boleto e Consulta de faixas de nosso número disponíveis.
    10 por segundo

    POST Incluir Boletos.
    5 por segundo

    PATCH Alterar dados de um boleto.
    5 por segundo

    Demais endpoints.
    20 por segundo

    Cobrança Bancária Pagamentos: 2 por segundo.
    Conta Corrente: 2 por segundo.
    Open Finance - Iniciação de Pagamento: 5 por segundo.
    Pagamentos Pix: 1 por segundo.
    Pix: 50 por segundo.
    Poupança: 2 por segundo.
    SPB Transferências: 2 por segundo.

Os limites também poderão ser encontrados nas seções das APIs dispostas nesta documentação.

Agradecemos a compreensão e a colaboração de todos os nossos parceiros e desenvolvedores, pois juntos continuamos a evoluir e fortalecer o ecossistema digital do Sicoob.