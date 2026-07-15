// Common-name -> Latin-name reference for cut flowers/foliage commonly sold
// through AU floral wholesale. Not botanically exhaustive — a starter list so
// buyer search matches a listing regardless of which name they know it by.
// Growers can still free-type a name that isn't in this list.

export interface FlowerSpecies {
  commonName: string
  latinName: string
}

export const FLOWER_SPECIES: FlowerSpecies[] = [
  { commonName: 'Rose', latinName: 'Rosa' },
  { commonName: 'Ranunculus', latinName: 'Ranunculus asiaticus' },
  { commonName: 'Peony', latinName: 'Paeonia lactiflora' },
  { commonName: 'Dahlia', latinName: 'Dahlia' },
  { commonName: 'Hydrangea', latinName: 'Hydrangea macrophylla' },
  { commonName: 'Sunflower', latinName: 'Helianthus annuus' },
  { commonName: 'Tulip', latinName: 'Tulipa' },
  { commonName: 'Lisianthus', latinName: 'Eustoma grandiflorum' },
  { commonName: 'Anemone', latinName: 'Anemone coronaria' },
  { commonName: 'Chrysanthemum', latinName: 'Chrysanthemum morifolium' },
  { commonName: 'Carnation', latinName: 'Dianthus caryophyllus' },
  { commonName: 'Gerbera', latinName: 'Gerbera jamesonii' },
  { commonName: 'Protea', latinName: 'Protea cynaroides' },
  { commonName: 'Waxflower', latinName: 'Chamelaucium uncinatum' },
  { commonName: 'Snapdragon', latinName: 'Antirrhinum majus' },
  { commonName: 'Amaranthus', latinName: 'Amaranthus caudatus' },
  { commonName: 'Eucalyptus', latinName: 'Eucalyptus cinerea' },
  { commonName: 'Delphinium', latinName: 'Delphinium elatum' },
  { commonName: 'Stock', latinName: 'Matthiola incana' },
  { commonName: 'Statice', latinName: 'Limonium sinuatum' },
  { commonName: 'Zinnia', latinName: 'Zinnia elegans' },
  { commonName: 'Cosmos', latinName: 'Cosmos bipinnatus' },
  { commonName: 'Iris', latinName: 'Iris germanica' },
  { commonName: 'Freesia', latinName: 'Freesia hybrida' },
  { commonName: 'Gladiolus', latinName: 'Gladiolus' },
  { commonName: 'Daffodil', latinName: 'Narcissus' },
  { commonName: 'Poppy', latinName: 'Papaver' },
  { commonName: 'Scabiosa', latinName: 'Scabiosa atropurpurea' },
  { commonName: 'Foxglove', latinName: 'Digitalis purpurea' },
  { commonName: 'Larkspur', latinName: 'Consolida ajacis' },
  { commonName: 'Celosia', latinName: 'Celosia argentea' },
  { commonName: 'Alstroemeria', latinName: 'Alstroemeria' },
  { commonName: 'Orchid', latinName: 'Cymbidium' },
  { commonName: 'Banksia', latinName: 'Banksia' },
  { commonName: 'Kangaroo Paw', latinName: 'Anigozanthos' },
  { commonName: 'Leucadendron', latinName: 'Leucadendron' },
  { commonName: 'Grevillea', latinName: 'Grevillea' },
  { commonName: 'Wattle', latinName: 'Acacia' },
  { commonName: 'Native Rosemary', latinName: 'Westringia fruticosa' },
  { commonName: 'Pittosporum', latinName: 'Pittosporum tenuifolium' },
  { commonName: 'Ruscus', latinName: 'Ruscus' },
]

/**
 * Best-effort lookup by common name (case-insensitive, substring match) —
 * used to auto-suggest a Latin name while a grower is typing a product name.
 */
export function findSpeciesByCommonName(query: string): FlowerSpecies | undefined {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return (
    FLOWER_SPECIES.find(s => s.commonName.toLowerCase() === q) ||
    FLOWER_SPECIES.find(s => s.commonName.toLowerCase().includes(q) || q.includes(s.commonName.toLowerCase()))
  )
}

export const COLOR_PALETTE = [
  { id: 'white', label: 'White', swatch: '#FFFFFF' },
  { id: 'cream', label: 'Cream', swatch: '#F5EDDD' },
  { id: 'blush', label: 'Blush', swatch: '#F3C9CB' },
  { id: 'pink', label: 'Pink', swatch: '#E8779E' },
  { id: 'red', label: 'Red', swatch: '#C2333B' },
  { id: 'orange', label: 'Orange', swatch: '#E8813A' },
  { id: 'yellow', label: 'Yellow', swatch: '#F2C230' },
  { id: 'green', label: 'Green', swatch: '#5A8C5E' },
  { id: 'purple', label: 'Purple / Lavender', swatch: '#9B7FC7' },
  { id: 'blue', label: 'Blue', swatch: '#5B7FBF' },
  { id: 'burgundy', label: 'Burgundy / Wine', swatch: '#6E2333' },
  { id: 'multicolor', label: 'Multicolor', swatch: 'conic-gradient(from 0deg, #E8779E, #F2C230, #5A8C5E, #5B7FBF, #E8779E)' },
] as const

export type ColorTagId = typeof COLOR_PALETTE[number]['id']
