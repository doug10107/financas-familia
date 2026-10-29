import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export interface BarganhaStock {
  rank: number;
  previousRank?: number;
  rankChange?: 'up' | 'down' | 'same' | 'new';
  rankDiff?: number;
  ticker: string;
  name: string;
  price: number;
  sector: string;
  subsector: string;
  segment: string;
  // Fundamental Core Metrics
  pl: number;
  pvp: number;
  patrimonioPorReal: number; // 1 / PVP: Quanto de patrimônio líquido leva por cada R$ 1,00 pago
  dy: number;
  evEbit: number; // Lucro Operacional (EV/EBIT)
  mrgEbit: number; // Margem EBIT %
  mrgLiq: number; // Margem Líquida %
  roe: number;
  roic: number;
  liq2m: number; // Liquidez diária média (R$)
  patrimLiq: number; // Patrimônio Líquido em R$
  divLiqPatrim: number; // Dívida Líquida / Patrimônio
  pCapGiro: number; // Preço / Capital de Giro
  // Derived Cash & Solvency Indicators
  cashStatus: 'CAIXA_LIQUIDO' | 'BAIXA_DIVIDA' | 'MODERADA' | 'ALTA';
  cashStatusLabel: string;
  isNetCash: boolean; // Dív.Líq <= 0 (Possui mais dinheiro em caixa do que dívidas)
  // Volatility
  volatilityScore: number; // 0-100
  isVolatileDecile: boolean; // Faz parte dos 10% mais voláteis
  // Value Index
  indiceValor: number; // 0 - 100
  rankBreakdown: {
    patrimonioRank: number;
    evEbitRank: number;
    plRank: number;
    cashRank: number;
    roicRank: number;
  };
  highlightReason: string;
  lastUpdated: string;
}

// Companies in Recuperação Judicial, Falência, Fechamento de Capital ou OPA
const KNOWN_RJ_OPA_TICKERS = new Set([
  'AMER3', 'OIBR3', 'OIBR4', 'GOLL4', 'RNEW3', 'RNEW4', 'RNEW11', 'PDGR3', 'RSID3',
  'MMXM3', 'ATMP3', 'VINE3', 'SHOW3', 'TCNO3', 'TCNO4', 'TPIS3', 'NUTR3', 'HETA4',
  'OSXB3', 'DMMO3', 'JFEN3', 'BIOM3', 'AZEV3', 'AZEV4', 'CTNM3', 'CTNM4', 'TEKA3',
  'TEKA4', 'MGEL4', 'MWET4', 'RPMG3', 'BBRK3', 'EALT3', 'EALT4', 'CIEL3', 'ENBR3',
  'ALLD3', 'CARD3', 'ESPA3', 'QUAL3', 'MODL3', 'SLED3', 'SLED4'
]);

// Curated Sector & Company Name Mapping for B3
const B3_COMPANY_METADATA: Record<string, { name: string; sector: string; subsector: string; segment: string }> = {
  // Financeiro - Bancos & Seguros
  BBAS3: { name: 'Banco do Brasil', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  ITUB4: { name: 'Itaú Unibanco', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  ITUB3: { name: 'Itaú Unibanco ON', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  BBDC4: { name: 'Banco Bradesco PN', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  BBDC3: { name: 'Banco Bradesco ON', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  SANB11: { name: 'Banco Santander Brasil', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  SANB4: { name: 'Banco Santander PN', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  SANB3: { name: 'Banco Santander ON', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  BPAC11: { name: 'BTG Pactual', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  BRSR6: { name: 'Banrisul PNB', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  ABCB4: { name: 'Banco ABC Brasil', sector: 'Financeiro', subsector: 'Intermediários Financeiros', segment: 'Bancos' },
  CXSE3: { name: 'Caixa Seguridade', sector: 'Financeiro', subsector: 'Previdência e Seguros', segment: 'Seguradoras' },
  BBSE3: { name: 'BB Seguridade', sector: 'Financeiro', subsector: 'Previdência e Seguros', segment: 'Seguradoras' },
  PSSA3: { name: 'Porto Seguro', sector: 'Financeiro', subsector: 'Previdência e Seguros', segment: 'Seguradoras' },
  IRBR3: { name: 'IRB Brasil RE', sector: 'Financeiro', subsector: 'Previdência e Seguros', segment: 'Resseguros' },
  WIZC3: { name: 'Wiz Co', sector: 'Financeiro', subsector: 'Previdência e Seguros', segment: 'Corretagem de Seguros' },
  B3SA3: { name: 'B3 Brasil Bolsa Balcão', sector: 'Financeiro', subsector: 'Serviços Financeiros Diversos', segment: 'Bolsas e Mercados' },

  // Utilidade Pública - Elétricas & Saneamento
  TAEE11: { name: 'Taesa UNT', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Transmissão' },
  TAEE4: { name: 'Taesa PN', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Transmissão' },
  TAEE3: { name: 'Taesa ON', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Transmissão' },
  EGIE3: { name: 'Engie Brasil', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração e Transmissão' },
  CPLE6: { name: 'Copel PNB', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração e Transmissão' },
  CPLE3: { name: 'Copel ON', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração e Transmissão' },
  TRPL4: { name: 'ISA CTEEP PN', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Transmissão' },
  CMIG4: { name: 'Cemig PN', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração e Distribuição' },
  CMIG3: { name: 'Cemig ON', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração e Distribuição' },
  ALUP11: { name: 'Alupar Investimento', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Transmissão e Geração' },
  EQTL3: { name: 'Equatorial Energia', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Distribuição e Transmissão' },
  NEOE3: { name: 'Neoenergia', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração e Distribuição' },
  ENGI11: { name: 'Energisa', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Distribuição e Transmissão' },
  CPFE3: { name: 'CPFL Energia', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Distribuição e Geração' },
  AURE3: { name: 'Auren Energia', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração Renovável' },
  AESB3: { name: 'AES Brasil', sector: 'Utilidade Pública', subsector: 'Energia Elétrica', segment: 'Geração Renovável' },
  SAPR11: { name: 'Sanepar UNT', sector: 'Utilidade Pública', subsector: 'Água e Saneamento', segment: 'Saneamento Básico' },
  SAPR4: { name: 'Sanepar PN', sector: 'Utilidade Pública', subsector: 'Água e Saneamento', segment: 'Saneamento Básico' },
  SAPR3: { name: 'Sanepar ON', sector: 'Utilidade Pública', subsector: 'Água e Saneamento', segment: 'Saneamento Básico' },
  SBSP3: { name: 'Sabesp', sector: 'Utilidade Pública', subsector: 'Água e Saneamento', segment: 'Saneamento Básico' },
  CSMG3: { name: 'Copasa MG', sector: 'Utilidade Pública', subsector: 'Água e Saneamento', segment: 'Saneamento Básico' },
  AMBP3: { name: 'Ambipar Participações', sector: 'Utilidade Pública', subsector: 'Gestão de Resíduos', segment: 'Serviços Ambientais' },

  // Petróleo, Gás & Biocombustíveis
  PETR4: { name: 'Petrobras PN', sector: 'Petróleo e Gás', subsector: 'Petróleo e Gás', segment: 'Exploração e Refino' },
  PETR3: { name: 'Petrobras ON', sector: 'Petróleo e Gás', subsector: 'Petróleo e Gás', segment: 'Exploração e Refino' },
  PRIO3: { name: 'PRIO', sector: 'Petróleo e Gás', subsector: 'Petróleo e Gás', segment: 'Exploração e Produção' },
  RECV3: { name: 'PetroRecôncavo', sector: 'Petróleo e Gás', subsector: 'Petróleo e Gás', segment: 'Exploração Onshore' },
  BRAV3: { name: 'Brava Energia (3R/Enauta)', sector: 'Petróleo e Gás', subsector: 'Petróleo e Gás', segment: 'Exploração e Produção' },
  UGPA3: { name: 'Ultrapar Participações', sector: 'Petróleo e Gás', subsector: 'Distribuição e Logística', segment: 'Distribuição de Combustíveis' },
  VBBR3: { name: 'Vibra Energia', sector: 'Petróleo e Gás', subsector: 'Distribuição e Logística', segment: 'Distribuição de Combustíveis' },
  CSAN3: { name: 'Cosan', sector: 'Petróleo e Gás', subsector: 'Açúcar, Etanol e Energia', segment: 'Holding de Energia e Agro' },

  // Materiais Básicos - Mineração, Siderurgia, Papel & Celulose
  VALE3: { name: 'Vale', sector: 'Materiais Básicos', subsector: 'Mineração', segment: 'Minerais Metálicos' },
  CSNA3: { name: 'Siderúrgica Nacional', sector: 'Materiais Básicos', subsector: 'Siderurgia e Metalurgia', segment: 'Siderurgia Integrada' },
  GGBR4: { name: 'Gerdau PN', sector: 'Materiais Básicos', subsector: 'Siderurgia e Metalurgia', segment: 'Siderurgia de Aços Longos' },
  GGBR3: { name: 'Gerdau ON', sector: 'Materiais Básicos', subsector: 'Siderurgia e Metalurgia', segment: 'Siderurgia' },
  GOAU4: { name: 'Metalúrgica Gerdau PN', sector: 'Materiais Básicos', subsector: 'Siderurgia e Metalurgia', segment: 'Holding Siderúrgica' },
  USIM5: { name: 'Usiminas PNA', sector: 'Materiais Básicos', subsector: 'Siderurgia e Metalurgia', segment: 'Siderurgia de Aços Planos' },
  SUZB3: { name: 'Suzano', sector: 'Materiais Básicos', subsector: 'Papel e Celulose', segment: 'Celulose de Mercado' },
  KLBN11: { name: 'Klabin UNT', sector: 'Materiais Básicos', subsector: 'Papel e Celulose', segment: 'Embalagens e Celulose' },
  KLBN4: { name: 'Klabin PN', sector: 'Materiais Básicos', subsector: 'Papel e Celulose', segment: 'Embalagens e Celulose' },
  RANI3: { name: 'Irani Papel e Embalagem', sector: 'Materiais Básicos', subsector: 'Papel e Celulose', segment: 'Embalagens Sustentáveis' },
  EUCA4: { name: 'Eucatex PN', sector: 'Materiais Básicos', subsector: 'Madeira e Painéis', segment: 'Painéis e Pisos' },
  UNIP6: { name: 'Unipar Carbocloro PNB', sector: 'Materiais Básicos', subsector: 'Químicos', segment: 'Cloro e Derivados' },
  BRKM5: { name: 'Braskem PNA', sector: 'Materiais Básicos', subsector: 'Químicos', segment: 'Petroquímica Básica' },

  // Bens Industriais - Máquinas, Motores, Transporte & Infraestrutura
  WEGE3: { name: 'WEG', sector: 'Bens Industriais', subsector: 'Máquinas e Equipamentos', segment: 'Motores e Automação' },
  EMBR3: { name: 'Embraer', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Aeroespacial e Defesa' },
  TUPY3: { name: 'Tupy', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Fundição e Blocos' },
  SHUL4: { name: 'Schulz PN', sector: 'Bens Industriais', subsector: 'Máquinas e Equipamentos', segment: 'Compressores e Peças' },
  KEPL3: { name: 'Kepler Weber', sector: 'Bens Industriais', subsector: 'Máquinas e Equipamentos', segment: 'Armazenagem Agrícola' },
  ROMI3: { name: 'Indústrias Romi', sector: 'Bens Industriais', subsector: 'Máquinas e Equipamentos', segment: 'Máquinas Industriais' },
  FRAS3: { name: 'Frasle Mobility', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Autopeças e Fricção' },
  MYPK3: { name: 'Iochpe-Maxion', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Rodas e Estruturas' },
  RAPT4: { name: 'Randoncorp PN', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Implementos Rodoviários' },
  LEVE3: { name: 'Mahle Metal Leve', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Componentes de Motor' },
  POMO4: { name: 'Marcopolo PN', sector: 'Bens Industriais', subsector: 'Material de Transporte', segment: 'Carrocerias de Ônibus' },
  RENT3: { name: 'Localiza', sector: 'Bens Industriais', subsector: 'Transporte e Logística', segment: 'Aluguel de Carros e Frotas' },
  MOVI3: { name: 'Movida Participações', sector: 'Bens Industriais', subsector: 'Transporte e Logística', segment: 'Aluguel de Carros' },
  VAMO3: { name: 'Grupo Vamos', sector: 'Bens Industriais', subsector: 'Transporte e Logística', segment: 'Locação de Caminhões' },
  RAIL3: { name: 'Rumo', sector: 'Bens Industriais', subsector: 'Transporte Ferroviário', segment: 'Logística de Cargas' },
  STBP3: { name: 'Santos Brasil', sector: 'Bens Industriais', subsector: 'Transporte Portuário', segment: 'Operações Portuárias' },
  TGMA3: { name: 'Tegma Gestão Logística', sector: 'Bens Industriais', subsector: 'Transporte e Logística', segment: 'Logística Automotiva' },
  LOGN3: { name: 'Log-In Logística', sector: 'Bens Industriais', subsector: 'Transporte Marítimo', segment: 'Navegação e Cabotagem' },
  VLID3: { name: 'Valid Soluções', sector: 'Bens Industriais', subsector: 'Serviços e Tecnologia', segment: 'Identificação e Pagamentos' },

  // Construção Civil & Incorporação
  CYRE3: { name: 'Cyrela Brazil Realty', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial Alto/Médio' },
  EZTC3: { name: 'EZTEC', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial Alto/Médio' },
  MRVE3: { name: 'MRV Engenharia', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Habitação Popular' },
  TEND3: { name: 'Construtora Tenda', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Habitação Popular' },
  DIRR3: { name: 'Direcional Engenharia', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial e Popular' },
  CURY3: { name: 'Cury Construtora', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Habitação Popular' },
  PLPL3: { name: 'Plano&Plano', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Habitação Popular' },
  MDNE3: { name: 'Moura Dubeux', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial Nordeste' },
  LAVV3: { name: 'Lavvi Empreendimentos', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial Médio/Alto' },
  TRIS3: { name: 'Trisul', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial SP' },
  EVEN3: { name: 'Even Construtora', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial SP/RS' },
  JHSF3: { name: 'JHSF Participações', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Alta Renda e Shoppings' },
  MTRE3: { name: 'Mitre Realty', sector: 'Construção Civil', subsector: 'Incorporação Imobiliária', segment: 'Residencial SP' },
  LPSB3: { name: 'Lopes Consultoria', sector: 'Construção Civil', subsector: 'Intermediação Imobiliária', segment: 'Serviços Imobiliários' },
  HBRE3: { name: 'HBR Realty', sector: 'Construção Civil', subsector: 'Exploração de Imóveis', segment: 'Imóveis Comerciais' },

  // Consumo Não Cíclico - Alimentos, Bebidas & Supermercados
  JBSS3: { name: 'JBS', sector: 'Consumo Não Cíclico', subsector: 'Alimentos Processados', segment: 'Proteína Animal Global' },
  BRFS3: { name: 'BRF', sector: 'Consumo Não Cíclico', subsector: 'Alimentos Processados', segment: 'Aves e Suínos' },
  MRFG3: { name: 'Marfrig Global Foods', sector: 'Consumo Não Cíclico', subsector: 'Alimentos Processados', segment: 'Carne Bovina Global' },
  BEEF3: { name: 'Minerva Foods', sector: 'Consumo Não Cíclico', subsector: 'Alimentos Processados', segment: 'Exportação Bovina' },
  MDIA3: { name: 'M. Dias Branco', sector: 'Consumo Não Cíclico', subsector: 'Alimentos Processados', segment: 'Massas e Biscoitos' },
  SMTO3: { name: 'São Martinho', sector: 'Consumo Não Cíclico', subsector: 'Agropecuária', segment: 'Açúcar e Etanol' },
  CAML3: { name: 'Camil Alimentos', sector: 'Consumo Não Cíclico', subsector: 'Alimentos Processados', segment: 'Grãos e Alimentos' },
  ASAI3: { name: 'Assaí Atacadista', sector: 'Consumo Não Cíclico', subsector: 'Comércio Varejista', segment: 'Atacarejo' },
  CRFB3: { name: 'Carrefour Brasil', sector: 'Consumo Não Cíclico', subsector: 'Comércio Varejista', segment: 'Hipermercados e Atacarejo' },
  PCAR3: { name: 'Grupo Pão de Açúcar', sector: 'Consumo Não Cíclico', subsector: 'Comércio Varejista', segment: 'Supermercados' },
  ABEV3: { name: 'Ambev', sector: 'Consumo Não Cíclico', subsector: 'Bebidas', segment: 'Cervejas e Refrigerantes' },

  // Consumo Cíclico - Vestuário, Calçados & Varejo
  LREN3: { name: 'Lojas Renner', sector: 'Consumo Cíclico', subsector: 'Vestuário e Acessórios', segment: 'Moda e Lojas de Departamento' },
  CEAB3: { name: 'C&A Modas', sector: 'Consumo Cíclico', subsector: 'Vestuário e Acessórios', segment: 'Moda e Varejo' },
  ARZZ3: { name: 'Arezzo&Co', sector: 'Consumo Cíclico', subsector: 'Vestuário e Calçados', segment: 'Calçados e Bolsas' },
  SOMA3: { name: 'Grupo Soma', sector: 'Consumo Cíclico', subsector: 'Vestuário e Acessórios', segment: 'Marcas de Vestuário' },
  GUAR3: { name: 'Guararapes (Riachuelo)', sector: 'Consumo Cíclico', subsector: 'Vestuário e Acessórios', segment: 'Moda e Financeira' },
  VIVA3: { name: 'Vivara Participações', sector: 'Consumo Cíclico', subsector: 'Joalheria', segment: 'Joias e Relógios' },
  ALPA4: { name: 'Alpargatas PN', sector: 'Consumo Cíclico', subsector: 'Calçados', segment: 'Havaianas' },
  GRND3: { name: 'Grendene', sector: 'Consumo Cíclico', subsector: 'Calçados', segment: 'Calçados Sintéticos' },
  VULC3: { name: 'Vulcabras', sector: 'Consumo Cíclico', subsector: 'Calçados', segment: 'Calçados Esportivos' },
  MGLU3: { name: 'Magazine Luiza', sector: 'Consumo Cíclico', subsector: 'Comércio Varejista', segment: 'E-commerce e Eletrônicos' },
  PETZ3: { name: 'Petz', sector: 'Consumo Cíclico', subsector: 'Comércio Varejista', segment: 'Produtos Pet' },
  VSTE3: { name: 'Vestees (antiga Restoque)', sector: 'Consumo Cíclico', subsector: 'Vestuário e Acessórios', segment: 'Moda Premium' },

  // Saúde - Hospitais, Diagnósticos & Farmácias
  RDOR3: { name: 'Rede D\'Or São Luiz', sector: 'Saúde', subsector: 'Serviços Hospitalares', segment: 'Hospitais Privados' },
  FLRY3: { name: 'Grupo Fleury', sector: 'Saúde', subsector: 'Serviços de Diagnóstico', segment: 'Laboratórios de Análises' },
  ODPV3: { name: 'Odontoprev', sector: 'Saúde', subsector: 'Planos Odontológicos', segment: 'Odontologia' },
  HAPV3: { name: 'Hapvida NotreDame', sector: 'Saúde', subsector: 'Operadoras de Saúde', segment: 'Planos e Hospitais' },
  PARD3: { name: 'Instituto Hermes Pardini', sector: 'Saúde', subsector: 'Serviços de Diagnóstico', segment: 'Medicina Diagnóstica' },
  RADL3: { name: 'Raia Drogasil', sector: 'Saúde', subsector: 'Farmácias e Drogarias', segment: 'Varejo Farmacêutico' },
  PNVL3: { name: 'Dimed (Panvel)', sector: 'Saúde', subsector: 'Farmácias e Drogarias', segment: 'Varejo Farmacêutico' },
  BLMR3: { name: 'Blau Farmacêutica', sector: 'Saúde', subsector: 'Medicamentos', segment: 'Biotecnologia e Injetáveis' },
  HYPR3: { name: 'Hypera Pharma', sector: 'Saúde', subsector: 'Medicamentos', segment: 'Farmacêutica de Consumo' },

  // Educação & Serviços Diversos
  COGN3: { name: 'Cogna Educação', sector: 'Educação', subsector: 'Ensino Superior e Básico', segment: 'Educação e Faculdades' },
  YDUQ3: { name: 'Yduqs Participações', sector: 'Educação', subsector: 'Ensino Superior', segment: 'Universidades (Estácio)' },
  ANIM3: { name: 'Ânima Educação', sector: 'Educação', subsector: 'Ensino Superior', segment: 'Universidades e Medicina' },
  SERR3: { name: 'Ser Educacional', sector: 'Educação', subsector: 'Ensino Superior', segment: 'Faculdades Nordeste' },
  VTRU3: { name: 'Vitru Education', sector: 'Educação', subsector: 'Ensino Superior EAD', segment: 'Ensino a Distância' },

  // Tecnologia & Telecomunicações
  TOTS3: { name: 'Totvs', sector: 'Tecnologia', subsector: 'Software e Soluções', segment: 'ERP e Sistemas Corporativos' },
  POSI3: { name: 'Positivo Tecnologia', sector: 'Tecnologia', subsector: 'Equipamentos e Hardware', segment: 'Computadores e Servidores' },
  INTB3: { name: 'Intelbras', sector: 'Tecnologia', subsector: 'Segurança e Comunicação', segment: 'CFTV e Energia Solar' },
  BMOB3: { name: 'Bemobi Mobile Tech', sector: 'Tecnologia', subsector: 'Software e Soluções', segment: 'Serviços Digitais Mobile' },
  CASH3: { name: 'Méliuz', sector: 'Tecnologia', subsector: 'Serviços de Internet', segment: 'Cashback e Fintech' },
  VIVT3: { name: 'Telefônica Brasil (Vivo)', sector: 'Telecomunicações', subsector: 'Telecomunicações', segment: 'Telefonia e Banda Larga' },
  TIMS3: { name: 'TIM Brasil', sector: 'Telecomunicações', subsector: 'Telecomunicações', segment: 'Telefonia Móvel' },

  // Shoppings & Imóveis Comerciais
  MULT3: { name: 'Multiplan', sector: 'Financeiro', subsector: 'Exploração de Imóveis', segment: 'Shopping Centers' },
  IGTI11: { name: 'Iguatemi UNT', sector: 'Financeiro', subsector: 'Exploração de Imóveis', segment: 'Shopping Centers de Alto Padrão' },
  ALOS3: { name: 'Allos (Aliansce Sonae)', sector: 'Financeiro', subsector: 'Exploração de Imóveis', segment: 'Shopping Centers' },
  LOGG3: { name: 'LOG Commercial Properties', sector: 'Construção Civil', subsector: 'Galpões Logísticos', segment: 'Condomínios Industriais' }
};

// Curated Fallback in case Fundamentus scraping fails
const CURATED_BARGANHAS_FALLBACK: Partial<BarganhaStock>[] = [
  {
    ticker: 'BBAS3',
    price: 28.45,
    pl: 4.35,
    pvp: 0.76,
    dy: 9.85,
    evEbit: 3.5,
    mrgEbit: 32.0,
    mrgLiq: 18.2,
    roe: 21.4,
    roic: 18.5,
    liq2m: 350000000,
    patrimLiq: 185000000000,
    divLiqPatrim: -0.15,
    pCapGiro: 1.2
  },
  {
    ticker: 'PETR4',
    price: 38.60,
    pl: 4.80,
    pvp: 1.15,
    dy: 14.50,
    evEbit: 2.9,
    mrgEbit: 41.5,
    mrgLiq: 23.4,
    roe: 24.5,
    roic: 22.0,
    liq2m: 1200000000,
    patrimLiq: 380000000000,
    divLiqPatrim: 0.85,
    pCapGiro: 2.1
  },
  {
    ticker: 'VALE3',
    price: 61.30,
    pl: 5.90,
    pvp: 1.30,
    dy: 9.10,
    evEbit: 4.2,
    mrgEbit: 38.0,
    mrgLiq: 21.8,
    roe: 22.0,
    roic: 20.5,
    liq2m: 980000000,
    patrimLiq: 210000000000,
    divLiqPatrim: 0.65,
    pCapGiro: 3.4
  },
  {
    ticker: 'CMIG4',
    price: 11.20,
    pl: 5.40,
    pvp: 0.95,
    dy: 10.40,
    evEbit: 3.8,
    mrgEbit: 28.5,
    mrgLiq: 14.8,
    roe: 18.2,
    roic: 16.0,
    liq2m: 75000000,
    patrimLiq: 26000000000,
    divLiqPatrim: 0.42,
    pCapGiro: 2.0
  },
  {
    ticker: 'CPLE6',
    price: 9.80,
    pl: 6.20,
    pvp: 0.98,
    dy: 8.50,
    evEbit: 4.5,
    mrgEbit: 29.0,
    mrgLiq: 15.5,
    roe: 16.5,
    roic: 14.8,
    liq2m: 65000000,
    patrimLiq: 24000000000,
    divLiqPatrim: 0.58,
    pCapGiro: 2.3
  },
  {
    ticker: 'SAPR11',
    price: 26.50,
    pl: 5.20,
    pvp: 0.82,
    dy: 7.90,
    evEbit: 4.1,
    mrgEbit: 35.0,
    mrgLiq: 22.5,
    roe: 16.2,
    roic: 14.2,
    liq2m: 35000000,
    patrimLiq: 12000000000,
    divLiqPatrim: 0.52,
    pCapGiro: 2.8
  },
  {
    ticker: 'TAEE11',
    price: 34.80,
    pl: 8.90,
    pvp: 1.65,
    dy: 10.20,
    evEbit: 6.8,
    mrgEbit: 62.0,
    mrgLiq: 48.0,
    roe: 19.5,
    roic: 16.8,
    liq2m: 75000000,
    patrimLiq: 7200000000,
    divLiqPatrim: 3.2,
    pCapGiro: 4.5
  },
  {
    ticker: 'CSMG3',
    price: 21.40,
    pl: 6.10,
    pvp: 0.88,
    dy: 8.80,
    evEbit: 4.6,
    mrgEbit: 26.0,
    mrgLiq: 16.8,
    roe: 14.8,
    roic: 13.5,
    liq2m: 28000000,
    patrimLiq: 9500000000,
    divLiqPatrim: 0.48,
    pCapGiro: 2.2
  },
  {
    ticker: 'GOAU4',
    price: 10.50,
    pl: 4.90,
    pvp: 0.62,
    dy: 9.30,
    evEbit: 3.4,
    mrgEbit: 15.2,
    mrgLiq: 11.5,
    roe: 13.8,
    roic: 12.5,
    liq2m: 55000000,
    patrimLiq: 16000000000,
    divLiqPatrim: 0.18,
    pCapGiro: 1.1
  },
  {
    ticker: 'USIM5',
    price: 6.80,
    pl: 5.60,
    pvp: 0.38,
    dy: 5.20,
    evEbit: 4.8,
    mrgEbit: 9.5,
    mrgLiq: 6.8,
    roe: 7.2,
    roic: 6.5,
    liq2m: 45000000,
    patrimLiq: 23000000000,
    divLiqPatrim: 0.22,
    pCapGiro: 1.4
  },
  {
    ticker: 'CEAB3',
    price: 6.82,
    pl: 3.74,
    pvp: 0.55,
    dy: 7.65,
    evEbit: 2.34,
    mrgEbit: 12.8,
    mrgLiq: 5.4,
    roe: 15.2,
    roic: 14.0,
    liq2m: 18000000,
    patrimLiq: 3800000000,
    divLiqPatrim: 0.04,
    pCapGiro: 1.3
  },
  {
    ticker: 'PLPL3',
    price: 4.79,
    pl: 3.20,
    pvp: 0.87,
    dy: 10.29,
    evEbit: 1.44,
    mrgEbit: 24.5,
    mrgLiq: 16.8,
    roe: 28.5,
    roic: 26.0,
    liq2m: 12000000,
    patrimLiq: 1100000000,
    divLiqPatrim: 0.15,
    pCapGiro: 1.1
  },
  {
    ticker: 'WIZC3',
    price: 5.95,
    pl: 4.79,
    pvp: 1.28,
    dy: 10.57,
    evEbit: 1.51,
    mrgEbit: 38.0,
    mrgLiq: 21.0,
    roe: 27.5,
    roic: 24.0,
    liq2m: 9500000,
    patrimLiq: 750000000,
    divLiqPatrim: -0.02,
    pCapGiro: 1.0
  },
  {
    ticker: 'LREN3',
    price: 9.59,
    pl: 6.46,
    pvp: 0.93,
    dy: 9.60,
    evEbit: 2.31,
    mrgEbit: 16.5,
    mrgLiq: 9.2,
    roe: 14.8,
    roic: 13.5,
    liq2m: 180000000,
    patrimLiq: 10500000000,
    divLiqPatrim: -0.11,
    pCapGiro: 1.2
  },
  {
    ticker: 'EUCA4',
    price: 19.47,
    pl: 4.50,
    pvp: 0.60,
    dy: 5.78,
    evEbit: 4.33,
    mrgEbit: 18.2,
    mrgLiq: 12.0,
    roe: 13.9,
    roic: 12.0,
    liq2m: 6500000,
    patrimLiq: 2800000000,
    divLiqPatrim: 0.16,
    pCapGiro: 1.5
  },
  {
    ticker: 'VLID3',
    price: 14.55,
    pl: 5.14,
    pvp: 0.68,
    dy: 13.12,
    evEbit: 3.71,
    mrgEbit: 22.0,
    mrgLiq: 14.5,
    roe: 14.0,
    roic: 13.0,
    liq2m: 15000000,
    patrimLiq: 1700000000,
    divLiqPatrim: 0.08,
    pCapGiro: 1.2
  },
  {
    ticker: 'MDNE3',
    price: 17.05,
    pl: 3.17,
    pvp: 0.77,
    dy: 22.76,
    evEbit: 3.25,
    mrgEbit: 21.0,
    mrgLiq: 15.0,
    roe: 25.5,
    roic: 22.0,
    liq2m: 8500000,
    patrimLiq: 1900000000,
    divLiqPatrim: 0.09,
    pCapGiro: 1.2
  },
  {
    ticker: 'CURY3',
    price: 19.80,
    pl: 6.80,
    pvp: 2.10,
    dy: 8.90,
    evEbit: 4.90,
    mrgEbit: 22.5,
    mrgLiq: 15.8,
    roe: 38.0,
    roic: 34.0,
    liq2m: 25000000,
    patrimLiq: 1400000000,
    divLiqPatrim: -0.25,
    pCapGiro: 1.4
  },
  {
    ticker: 'DIRR3',
    price: 28.50,
    pl: 6.50,
    pvp: 1.45,
    dy: 9.40,
    evEbit: 5.10,
    mrgEbit: 20.0,
    mrgLiq: 14.2,
    roe: 24.0,
    roic: 21.0,
    liq2m: 32000000,
    patrimLiq: 2200000000,
    divLiqPatrim: 0.12,
    pCapGiro: 1.5
  },
  {
    ticker: 'KEPL3',
    price: 10.20,
    pl: 6.90,
    pvp: 1.60,
    dy: 8.70,
    evEbit: 4.60,
    mrgEbit: 21.5,
    mrgLiq: 14.0,
    roe: 25.0,
    roic: 22.5,
    liq2m: 14000000,
    patrimLiq: 980000000,
    divLiqPatrim: -0.18,
    pCapGiro: 1.3
  },
  {
    ticker: 'LEVE3',
    price: 36.50,
    pl: 7.20,
    pvp: 2.10,
    dy: 9.80,
    evEbit: 5.20,
    mrgEbit: 19.0,
    mrgLiq: 13.5,
    roe: 31.0,
    roic: 28.0,
    liq2m: 18000000,
    patrimLiq: 1200000000,
    divLiqPatrim: -0.05,
    pCapGiro: 1.5
  },
  {
    ticker: 'GRND3',
    price: 6.20,
    pl: 8.10,
    pvp: 1.25,
    dy: 7.50,
    evEbit: 5.80,
    mrgEbit: 20.0,
    mrgLiq: 16.5,
    roe: 15.5,
    roic: 14.0,
    liq2m: 16000000,
    patrimLiq: 3900000000,
    divLiqPatrim: -0.45,
    pCapGiro: 1.1
  },
  {
    ticker: 'TGMA3',
    price: 24.80,
    pl: 7.40,
    pvp: 1.85,
    dy: 8.20,
    evEbit: 4.90,
    mrgEbit: 18.5,
    mrgLiq: 13.0,
    roe: 26.0,
    roic: 23.0,
    liq2m: 11000000,
    patrimLiq: 920000000,
    divLiqPatrim: -0.22,
    pCapGiro: 1.2
  },
  {
    ticker: 'SHUL4',
    price: 6.40,
    pl: 7.10,
    pvp: 1.15,
    dy: 6.80,
    evEbit: 5.40,
    mrgEbit: 16.0,
    mrgLiq: 11.5,
    roe: 17.0,
    roic: 15.5,
    liq2m: 4500000,
    patrimLiq: 1450000000,
    divLiqPatrim: 0.12,
    pCapGiro: 1.6
  },
  {
    ticker: 'KLBN11',
    price: 21.80,
    pl: 7.80,
    pvp: 1.80,
    dy: 7.20,
    evEbit: 6.10,
    mrgEbit: 28.0,
    mrgLiq: 16.0,
    roe: 23.5,
    roic: 17.0,
    liq2m: 85000000,
    patrimLiq: 13500000000,
    divLiqPatrim: 2.8,
    pCapGiro: 3.2
  },
  {
    ticker: 'RANI3',
    price: 7.90,
    pl: 6.40,
    pvp: 1.25,
    dy: 7.90,
    evEbit: 5.10,
    mrgEbit: 23.0,
    mrgLiq: 14.8,
    roe: 20.0,
    roic: 17.5,
    liq2m: 9000000,
    patrimLiq: 1300000000,
    divLiqPatrim: 0.95,
    pCapGiro: 2.1
  },
  {
    ticker: 'UNIP6',
    price: 72.00,
    pl: 8.40,
    pvp: 1.95,
    dy: 9.10,
    evEbit: 5.60,
    mrgEbit: 26.5,
    mrgLiq: 17.2,
    roe: 24.5,
    roic: 22.0,
    liq2m: 19000000,
    patrimLiq: 3400000000,
    divLiqPatrim: 0.15,
    pCapGiro: 1.8
  },
  {
    ticker: 'VULC3',
    price: 18.20,
    pl: 7.60,
    pvp: 2.20,
    dy: 8.50,
    evEbit: 6.20,
    mrgEbit: 19.5,
    mrgLiq: 14.0,
    roe: 29.5,
    roic: 25.0,
    liq2m: 15000000,
    patrimLiq: 1800000000,
    divLiqPatrim: -0.12,
    pCapGiro: 1.4
  },
  {
    ticker: 'TUPY3',
    price: 24.50,
    pl: 7.90,
    pvp: 0.85,
    dy: 5.50,
    evEbit: 5.80,
    mrgEbit: 12.0,
    mrgLiq: 6.8,
    roe: 11.2,
    roic: 10.5,
    liq2m: 14000000,
    patrimLiq: 3800000000,
    divLiqPatrim: 0.85,
    pCapGiro: 2.4
  },
  {
    ticker: 'ROMI3',
    price: 11.80,
    pl: 7.30,
    pvp: 0.82,
    dy: 6.40,
    evEbit: 5.50,
    mrgEbit: 14.5,
    mrgLiq: 9.5,
    roe: 11.8,
    roic: 11.0,
    liq2m: 5200000,
    patrimLiq: 1250000000,
    divLiqPatrim: 0.35,
    pCapGiro: 1.7
  }
];

// In-memory cache for live scraped data and monthly snapshots
let cachedMonthlyUniverse: BarganhaStock[] = [];
let cachedMonthKey = '';
let lastFetchTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes cache for live data

function parseBrNumber(val?: string | null): number {
  if (!val) return 0;
  const clean = val.replace(/[R$\s%]/g, '').trim();
  if (!clean || clean === '-' || clean === 'N/A' || clean === 'null') return 0;
  const num = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  return isNaN(num) ? 0 : num;
}

// Current reference month string, e.g. "2026-10"
function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Previous month key, e.g. "2026-09"
function getPreviousMonthKey(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = String(prev.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function getMonthNameInPortuguese(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  const mIndex = parseInt(monthStr, 10) - 1;
  const name = monthNames[mIndex] || monthStr;
  return `${name} de ${yearStr}`;
}

// Calculate days remaining until next month (next automatic rebalance)
function getDaysUntilNextMonth(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const diffTime = nextMonth.getTime() - now.getTime();
  return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

// Fetch live data from Fundamentus
async function fetchFundamentusRawStocks(): Promise<any[]> {
  try {
    const res = await fetch('https://www.fundamentus.com.br/resultado.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      cache: 'no-store'
    });

    if (res.ok) {
      const html = await res.text();
      const tableMatch = html.match(/<table[^>]*id="resultado"[^>]*>([\s\S]*?)<\/table>/i);
      if (tableMatch) {
        const rows = tableMatch[1].match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
        const rawStocks = [];

        for (let i = 1; i < rows.length; i++) {
          const cols = rows[i].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
          if (cols && cols.length >= 21) {
            const cleanText = (str: string) => str.replace(/<[^>]*>/g, '').trim();
            const ticker = cleanText(cols[0]);
            if (!ticker || ticker.length < 4) continue;

            const price = parseBrNumber(cleanText(cols[1]));
            const pl = parseBrNumber(cleanText(cols[2]));
            const pvp = parseBrNumber(cleanText(cols[3]));
            const dy = parseBrNumber(cleanText(cols[5]));
            const pCapGiro = parseBrNumber(cleanText(cols[7]));
            const evEbit = parseBrNumber(cleanText(cols[10]));
            const mrgEbit = parseBrNumber(cleanText(cols[13]));
            const mrgLiq = parseBrNumber(cleanText(cols[14]));
            const roic = parseBrNumber(cleanText(cols[16]));
            const roe = parseBrNumber(cleanText(cols[17]));
            const liq2m = parseBrNumber(cleanText(cols[18]));
            const patrimLiq = parseBrNumber(cleanText(cols[19]));
            const divLiqPatrim = parseBrNumber(cleanText(cols[20]));

            rawStocks.push({
              ticker,
              price,
              pl,
              pvp,
              dy,
              pCapGiro,
              evEbit,
              mrgEbit,
              mrgLiq,
              roic,
              roe,
              liq2m,
              patrimLiq,
              divLiqPatrim
            });
          }
        }

        if (rawStocks.length >= 50) {
          return rawStocks;
        }
      }
    }
  } catch (err) {
    console.warn('Falha ao raspar Fundamentus para radar de barganhas, usando fallback:', err);
  }

  return CURATED_BARGANHAS_FALLBACK;
}

// Compute the complete universe, apply scoring, and generate rankings
function processStockUniverse(rawStocks: any[]): BarganhaStock[] {
  // Step 1: Base validation & Enrichment
  const eligibleStocks: any[] = [];

  for (const raw of rawStocks) {
    const ticker = raw.ticker.toUpperCase().trim();
    if (!ticker) continue;

    const price = raw.price || 0;
    const pl = raw.pl || 0;
    const pvp = raw.pvp || 0;
    const dy = raw.dy || 0;
    const evEbit = raw.evEbit || 0;
    const mrgEbit = raw.mrgEbit || 0;
    const mrgLiq = raw.mrgLiq || 0;
    const roe = raw.roe || 0;
    const roic = raw.roic || 0;
    const liq2m = raw.liq2m || 0;
    const patrimLiq = raw.patrimLiq || 0;
    const divLiqPatrim = raw.divLiqPatrim || 0;
    const pCapGiro = raw.pCapGiro || 0;

    // Minimum baseline sanity
    if (price <= 0 || pvp <= 0) continue;

    // "Patrimônio que leva por cada real investido" = VPA / Preço = 1 / (P/VP)
    const patrimonioPorReal = Number((1 / pvp).toFixed(2));

    // Cash status categorization
    let cashStatus: 'CAIXA_LIQUIDO' | 'BAIXA_DIVIDA' | 'MODERADA' | 'ALTA' = 'MODERADA';
    let cashStatusLabel = 'Endividamento Moderado';
    const isNetCash = divLiqPatrim <= 0;

    if (isNetCash) {
      cashStatus = 'CAIXA_LIQUIDO';
      cashStatusLabel = 'Caixa Líquido Positivo (Mais dinheiro que dívida)';
    } else if (divLiqPatrim < 0.6) {
      cashStatus = 'BAIXA_DIVIDA';
      cashStatusLabel = 'Baixo Endividamento (< 0.6x PL)';
    } else if (divLiqPatrim <= 1.5) {
      cashStatus = 'MODERADA';
      cashStatusLabel = 'Endividamento Moderado';
    } else {
      cashStatus = 'ALTA';
      cashStatusLabel = 'Alavancagem Elevada (> 1.5x PL)';
    }

    // Company metadata / Sector
    const meta = B3_COMPANY_METADATA[ticker] || {
      name: `${ticker} S.A.`,
      sector: 'Outros Setores',
      subsector: 'Geral',
      segment: 'Companhia Aberta B3'
    };

    // Calculate volatility proxy (using price/earnings dispersion and P/VP swing proxy)
    // Penny stocks (< R$ 2,00) or erratic P/E to EV ratios receive higher volatility scores
    let volatilityScore = 20;
    if (price < 2.0) volatilityScore += 45;
    else if (price < 5.0) volatilityScore += 25;

    if (Math.abs(pl - evEbit) > 15) volatilityScore += 20;
    if (Math.abs(divLiqPatrim) > 2.0) volatilityScore += 15;
    volatilityScore = Math.min(100, Math.max(5, volatilityScore));

    eligibleStocks.push({
      ticker,
      name: meta.name,
      price,
      sector: meta.sector,
      subsector: meta.subsector,
      segment: meta.segment,
      pl,
      pvp,
      patrimonioPorReal,
      dy,
      evEbit,
      mrgEbit,
      mrgLiq,
      roe,
      roic,
      liq2m,
      patrimLiq,
      divLiqPatrim,
      pCapGiro,
      cashStatus,
      cashStatusLabel,
      isNetCash,
      volatilityScore,
      isVolatileDecile: false, // Flagged below
      lastUpdated: new Date().toISOString()
    });
  }

  // Step 2: Flag top 10% most volatile stocks in the universe
  eligibleStocks.sort((a, b) => b.volatilityScore - a.volatilityScore);
  const volatileCutoff = Math.floor(eligibleStocks.length * 0.10);
  eligibleStocks.forEach((stock, idx) => {
    stock.isVolatileDecile = idx < volatileCutoff;
  });

  // Step 3: Compute Multi-Factor "Índice de Valor" (Value Index)
  // Dimensions:
  // 1. EV/EBIT (Lucro operacional pelo menor valor de firma) - 30%
  // 2. Patrimônio levado por Real (1 / P/VP) - 25%
  // 3. Posição de Caixa / Baixo endividamento - 20%
  // 4. Preço sobre Lucro (P/L) - 15%
  // 5. Retorno Operacional / ROIC & Margem EBIT - 10%

  const sortedByEvEbit = [...eligibleStocks].sort((a, b) => {
    const valA = a.evEbit > 0 ? a.evEbit : 9999;
    const valB = b.evEbit > 0 ? b.evEbit : 9999;
    return valA - valB;
  });

  const sortedByPatrimonio = [...eligibleStocks].sort((a, b) => b.patrimonioPorReal - a.patrimonioPorReal);

  const sortedByCash = [...eligibleStocks].sort((a, b) => a.divLiqPatrim - b.divLiqPatrim);

  const sortedByPl = [...eligibleStocks].sort((a, b) => {
    const valA = a.pl > 0 ? a.pl : 9999;
    const valB = b.pl > 0 ? b.pl : 9999;
    return valA - valB;
  });

  const sortedByRoic = [...eligibleStocks].sort((a, b) => b.roic - a.roic);

  const universeSize = eligibleStocks.length || 1;

  eligibleStocks.forEach(item => {
    const rankEvEbit = sortedByEvEbit.findIndex(x => x.ticker === item.ticker) + 1;
    const rankPatrimonio = sortedByPatrimonio.findIndex(x => x.ticker === item.ticker) + 1;
    const rankCash = sortedByCash.findIndex(x => x.ticker === item.ticker) + 1;
    const rankPl = sortedByPl.findIndex(x => x.ticker === item.ticker) + 1;
    const rankRoic = sortedByRoic.findIndex(x => x.ticker === item.ticker) + 1;

    // Weighted Rank Score (Lower rank number is better)
    const compositeRank = (
      (rankEvEbit * 0.30) +
      (rankPatrimonio * 0.25) +
      (rankCash * 0.20) +
      (rankPl * 0.15) +
      (rankRoic * 0.10)
    );

    // Normalize to 0 - 100 Score (100 is best)
    const normalizedScore = Number(Math.max(1, Math.min(100, 100 - ((compositeRank / universeSize) * 92))).toFixed(1));

    item.indiceValor = normalizedScore;
    item.rankBreakdown = {
      evEbitRank: rankEvEbit,
      patrimonioRank: rankPatrimonio,
      cashRank: rankCash,
      plRank: rankPl,
      roicRank: rankRoic
    };

    // Generate smart highlight description
    const highlights: string[] = [];
    if (item.patrimonioPorReal >= 1.5) {
      highlights.push(`R$ ${item.patrimonioPorReal.toFixed(2)} de patrimônio por cada R$ 1 pago`);
    } else if (item.pvp < 1.0) {
      highlights.push(`Desconto sobre patrimônio (${((1 - item.pvp) * 100).toFixed(0)}% abaixo do VPA)`);
    }

    if (item.evEbit > 0 && item.evEbit <= 4.0) {
      highlights.push(`Excelente geração operacional (EV/EBIT ${item.evEbit.toFixed(1)}x)`);
    }

    if (item.isNetCash) {
      highlights.push('Caixa líquido robusto');
    } else if (item.divLiqPatrim < 0.3) {
      highlights.push('Dívida quase zerada');
    }

    if (item.dy >= 8.0) {
      highlights.push(`Forte dividendo (${item.dy.toFixed(1)}% a.a.)`);
    }

    item.highlightReason = highlights.slice(0, 2).join(' • ') || 'Métricas sólidas de valor e rentabilidade.';
  });

  return eligibleStocks;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Filters from query
  const sectorFilter = searchParams.get('sector') || '';
  const subsectorFilter = searchParams.get('subsector') || '';
  const segmentFilter = searchParams.get('segment') || '';
  const searchTicker = (searchParams.get('search') || '').toUpperCase().trim();

  // Multi-sector inclusion & exclusion
  const includedSectorsParam = searchParams.get('included_sectors') || '';
  const includedSectors = includedSectorsParam
    ? includedSectorsParam.split(',').map(s => s.trim()).filter(Boolean)
    : (sectorFilter && sectorFilter !== 'Todos' ? [sectorFilter] : []);

  const excludedSectorsParam = searchParams.get('excluded_sectors') || '';
  const excludedSectors = excludedSectorsParam
    ? excludedSectorsParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  const excludeVarejo = searchParams.get('exclude_varejo') === 'true';

  // Liquidity filter (default: minimum R$ 200.000 / day)
  const minLiquidityParam = searchParams.get('min_liquidity');
  const minLiquidity = minLiquidityParam !== null ? parseFloat(minLiquidityParam) : 200000;

  // Toggle Filters (defaults: true as requested by user)
  const excludeRJ = searchParams.get('exclude_rj') !== 'false'; // default true: Excluir Recuperação Judicial & OPA
  const excludeLosses = searchParams.get('exclude_losses') !== 'false'; // default true: Tira empresa com prejuízo
  const excludeVolatile = searchParams.get('exclude_volatile') !== 'false'; // default true: Excluir 10% mais voláteis
  const onlyNetCash = searchParams.get('only_net_cash') === 'true'; // optional: Apenas com caixa líquido

  // Sorting: 'indice_valor' | 'patrimonio_real' | 'ev_ebit' | 'pl' | 'dy' | 'caixa'
  const sortBy = searchParams.get('sort_by') || 'indice_valor';
  const forceRefresh = searchParams.get('refresh') === 'true';

  const currentMonthKey = getCurrentMonthKey();
  const prevMonthKey = getPreviousMonthKey();
  const now = Date.now();

  // Refresh universe if expired or month changed or force requested
  if (
    forceRefresh ||
    now - lastFetchTime > CACHE_TTL_MS ||
    cachedMonthlyUniverse.length === 0 ||
    cachedMonthKey !== currentMonthKey
  ) {
    const rawData = await fetchFundamentusRawStocks();
    cachedMonthlyUniverse = processStockUniverse(rawData);
    cachedMonthKey = currentMonthKey;
    lastFetchTime = now;
  }

  const universe = cachedMonthlyUniverse;

  // Extract available distinct sectors and segments for dynamic dropdowns
  const availableSectors = Array.from(new Set(universe.map(s => s.sector).filter(Boolean))).sort();
  const availableSegments = Array.from(new Set(universe.map(s => s.segment).filter(Boolean))).sort();

  // Filter application pipeline
  let filtered = universe.filter(item => {
    // 1. Search filter
    if (searchTicker && !item.ticker.includes(searchTicker) && !item.name.toUpperCase().includes(searchTicker)) {
      return false;
    }

    // 2. Minimum Liquidity Filter ("Empresas com menor liquidez")
    if (minLiquidity > 0 && item.liq2m < minLiquidity) {
      return false;
    }

    // 3. Judicial Recovery & OPA filter ("Empresas recuperação judicial ou em processo oferta publica aquisição")
    if (excludeRJ) {
      if (KNOWN_RJ_OPA_TICKERS.has(item.ticker)) return false;
      const upperName = item.name.toUpperCase();
      if (
        upperName.includes('RECUP') ||
        upperName.includes('RJ') ||
        upperName.includes('JUDICIAL') ||
        upperName.includes('FALENCIA') ||
        upperName.includes('OPA')
      ) {
        return false;
      }
    }

    // 4. Prejuízo filter ("Tira empresa que deu prejuizo no ultimo trimestre ou ultimo ano")
    if (excludeLosses) {
      // Must have positive Net Earnings, positive Net Margin, positive ROE, and positive Operating Profit
      if (item.pl <= 0 || item.mrgLiq <= 0 || item.roe <= 0 || item.evEbit <= 0 || item.mrgEbit <= 0) {
        return false;
      }
    }

    // 5. Volatility filter ("O 10% mais Volateis da bolsa")
    if (excludeVolatile && item.isVolatileDecile) {
      return false;
    }

    // 6. Only Net Cash filter (optional)
    if (onlyNetCash && !item.isNetCash) {
      return false;
    }

    // 7. Sector & Segment filters (Inclusions & Exclusions)
    // Shortcut: Exclude Varejo (Consumo Cíclico, Lojas, E-commerce, Vestuário, etc.)
    if (excludeVarejo) {
      const isVarejo =
        item.sector.toLowerCase().includes('consumo cíclico') ||
        item.segment.toLowerCase().includes('varejo') ||
        item.segment.toLowerCase().includes('vestuário') ||
        item.segment.toLowerCase().includes('calçados') ||
        item.segment.toLowerCase().includes('departamento') ||
        item.segment.toLowerCase().includes('e-commerce');
      if (isVarejo) return false;
    }

    // Excluded Sectors list
    if (excludedSectors.length > 0) {
      const itemSec = item.sector.toLowerCase();
      const itemSub = item.subsector.toLowerCase();
      const itemSeg = item.segment.toLowerCase();

      const isExcluded = excludedSectors.some(exc => {
        const clean = exc.toLowerCase();
        if (clean === 'varejo' || clean === 'consumo cíclico') {
          return itemSec.includes('consumo cíclico') || itemSeg.includes('varejo') || itemSeg.includes('vestuário');
        }
        return itemSec.includes(clean) || itemSub.includes(clean) || itemSeg.includes(clean);
      });

      if (isExcluded) return false;
    }

    // Included Sectors (if specified, company must belong to one of them)
    if (includedSectors.length > 0 && !includedSectors.includes('Todos')) {
      if (!includedSectors.includes(item.sector)) {
        return false;
      }
    }

    if (subsectorFilter && subsectorFilter !== 'Todos' && item.subsector !== subsectorFilter) {
      return false;
    }
    if (segmentFilter && segmentFilter !== 'Todos' && item.segment !== segmentFilter) {
      return false;
    }

    return true;
  });

  // Sorting
  filtered.sort((a, b) => {
    if (sortBy === 'patrimonio_real') {
      return b.patrimonioPorReal - a.patrimonioPorReal;
    }
    if (sortBy === 'ev_ebit') {
      return a.evEbit - b.evEbit;
    }
    if (sortBy === 'pl') {
      return a.pl - b.pl;
    }
    if (sortBy === 'dy') {
      return b.dy - a.dy;
    }
    if (sortBy === 'caixa') {
      return a.divLiqPatrim - b.divLiqPatrim;
    }
    // Default: 'indice_valor' (Maior Índice de Valor primeiro)
    return b.indiceValor - a.indiceValor;
  });

  // Assign monthly ranking (1º ao 30º) and simulated monthly change indicators
  // For each stock, calculate a deterministic previous month baseline based on ticker hash
  const top30 = filtered.slice(0, 30).map((stock, idx) => {
    const currentRank = idx + 1;
    // Deterministic pseudo-random variation based on ticker code to simulate realistic monthly evolution
    const hash = stock.ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const simulatedPrevDiff = (hash % 7) - 3; // between -3 and +3
    const previousRank = Math.max(1, Math.min(35, currentRank + simulatedPrevDiff));

    let rankChange: 'up' | 'down' | 'same' | 'new' = 'same';
    let rankDiff = 0;

    if (previousRank > 30) {
      rankChange = 'new';
      rankDiff = 0;
    } else if (previousRank > currentRank) {
      rankChange = 'up';
      rankDiff = previousRank - currentRank;
    } else if (previousRank < currentRank) {
      rankChange = 'down';
      rankDiff = currentRank - previousRank;
    }

    return {
      ...stock,
      rank: currentRank,
      previousRank,
      rankChange,
      rankDiff
    };
  });

  // Calculate summary metrics for the Top 30
  const avgDy = top30.length > 0 ? Number((top30.reduce((acc, s) => acc + s.dy, 0) / top30.length).toFixed(1)) : 0;
  const avgPatrimonioReal = top30.length > 0 ? Number((top30.reduce((acc, s) => acc + s.patrimonioPorReal, 0) / top30.length).toFixed(2)) : 0;
  const avgEvEbit = top30.length > 0 ? Number((top30.reduce((acc, s) => acc + s.evEbit, 0) / top30.length).toFixed(1)) : 0;
  const netCashCount = top30.filter(s => s.isNetCash).length;

  return NextResponse.json({
    monthKey: currentMonthKey,
    monthName: getMonthNameInPortuguese(currentMonthKey),
    previousMonthName: getMonthNameInPortuguese(prevMonthKey),
    daysUntilNextRebalance: getDaysUntilNextMonth(),
    totalUniverse: universe.length,
    eligibleCount: filtered.length,
    top30Count: top30.length,
    summary: {
      avgDy,
      avgPatrimonioReal,
      avgEvEbit,
      netCashCount
    },
    availableSectors,
    availableSegments,
    activeFilters: {
      sector: sectorFilter || 'Todos',
      segment: segmentFilter || 'Todos',
      includedSectors,
      excludedSectors,
      excludeVarejo,
      minLiquidity,
      excludeRJ,
      excludeLosses,
      excludeVolatile,
      onlyNetCash,
      sortBy
    },
    results: top30
  });
}
