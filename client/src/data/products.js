export const categories = [
  { id: 'all', name: 'All Fabrics' },
  { id: 'rigid-denim', name: 'Rigid Denim' },
  { id: 'stretch-denim', name: 'Stretch Denim' },
  { id: 'specialty-fabrics', name: 'Specialty & Sustainable' },
];

export const productGroups = [
  { title: 'Rigid Denim', description: 'Structured 3/1 twills from everyday midweight qualities to selvedge and workwear constructions.', categories: ['rigid-denim'] },
  { title: 'Stretch Denim', description: 'Comfort and high-recovery qualities engineered for jeans, skirts and fitted denim garments.', categories: ['stretch-denim'] },
  { title: 'Specialty & Sustainable', description: 'Black, ecru, recycled-content and lightweight fabrics for differentiated collections.', categories: ['specialty-fabrics'] },
];

export const categoryNames = Object.fromEntries(categories.filter(({ id }) => id !== 'all').map(({ id, name }) => [id, name]));
