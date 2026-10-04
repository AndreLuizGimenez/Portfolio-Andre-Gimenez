/* Conteúdo central do produto: nome provisório, textos das camadas, especificações, preço e destino de compra.
 * Alterações editoriais devem partir daqui para manter as seções consistentes. */
export const product = {
  brand: '"XXXX"',
  name: '"XXXX"',
  referenceModel: 'Castor Visco Soft New Hot & Cold 40 × 60 × 11 cm',
  referenceSku: '83581',
  sourceUrl: 'https://www.mercadolivre.com.br/travesseiro-castor-visco-soft-new-hot-cold-40x60x11cm/p/MLB22229518',
  imagesAreGenerated: true,
  demoPrice: null as number | null,
  placeholderPrice: 'R$ 000,00',
  checkoutUrl: null as string | null,
  isConcept: true,
  layers: [
    { part: 'lower', label: 'O tecido', calloutLabel: 'Tecido', title: 'Um toque\nmais natural.', text: 'Bambu e algodão no tecido que encontra a sua pele.', tag: '01 / BAMBU E ALGODÃO' },
    { part: 'foam', label: 'O enchimento', calloutLabel: 'Espuma', title: 'Conforto que\nse adapta.', text: 'Flocos de espuma viscoelástica acolhem o contorno do corpo.', tag: '02 / ESPUMA VISCOELÁSTICA' },
    { part: 'thermal', label: 'Conforto térmico', calloutLabel: 'Kulkote', title: 'Seu descanso.\nEm outro clima.', text: 'Kulkote na espuma para uma noite com mais frescor.', tag: '03 / HOT & COLD' },
  ],
  faqs: [
    { question: 'Qual é a composição?', answer: 'O modelo Castor Visco Soft New Hot & Cold tem enchimento de flocos de espuma viscoelástica com tratamento Kulkote e tecido de 57% bambu e 43% algodão. Na animação, o tecido e o enchimento são afastados para explicar a construção. Essa separação é ilustrativa: o produto não tem capa removível.' },
    { question: 'Como funciona o Hot & Cold?', answer: 'O tratamento Kulkote usa materiais de mudança de fase que absorvem e liberam calor, auxiliando na regulação térmica durante o contato. Na última etapa da animação, uma película azul desce sobre a espuma para ampliar visualmente esse tratamento. No produto, ele é aplicado à espuma, sem uma placa de gel independente. Não há refrigeração ativa, temperatura fixa ou duração de efeito gelado especificada.' },
    { question: 'Quais são as medidas?', answer: 'O modelo usado nesta apresentação mede 60 × 40 × 11 cm e é branco. As medidas correspondem à referência 40 × 60 × 11 cm, não às outras versões da mesma linha.' },
    { question: 'A capa sai? Posso lavar?', answer: 'A ficha consultada informa que o produto não tem zíper, a fronha não é removível e o travesseiro não é lavável. Para conservar o produto, siga as orientações da etiqueta.' },
    { question: 'As imagens são fotografias do produto?', answer: 'São visualizações geradas e esquemas ilustrativos baseados no modelo de referência. Servem para apresentar a proposta visual e não substituem fotografias ou a ficha do fabricante. "XXXX" continua sendo o nome provisório desta apresentação.' },
    { question: 'Já posso comprar?', answer: 'A compra está em preparação. Preço, disponibilidade, entrega, pagamento e condições de devolução serão informados quando a venda estiver disponível. Esta prévia não realiza pagamentos.' },
  ],
};
export const money = (value: number) => new Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'}).format(value);
