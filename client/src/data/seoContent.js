export function slugify(value=''){return value.toLowerCase().replace(/["“”']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
export function productSlug(product){return slugify(product?.name||product?.id||'denim-fabric')}

export const servicePages={
  'fit-and-size-guide':{
    title:'Denim Fabric Technical Guide',eyebrow:'For designers, developers and fabric buyers',
    intro:'Understand the key data behind denim selection—from weight and weave to stretch, shrinkage, skew, colorfastness and usable width.',image:'/fabric/rigid-indigo.png',
    sections:[
      ['Start with end use and weight','Fabric weight influences structure, drape and seasonal suitability. We discuss the garment type and wash process before matching an ounce or GSM target.'],
      ['Confirm construction and performance','Composition, twill direction, yarn character, stretch and recovery are reviewed together. Required test methods and limits should be agreed before bulk approval.'],
      ['Approve shade and wash-down','Indigo depth, cast, hand feel and wash response are physical standards. Swatches, lab dips and wash trials help connect the selected quality to the intended garment finish.'],
      ['Control bulk tolerances','Usable width, weight, shrinkage, skew, shade grouping and roll inspection criteria are documented for the approved fabric order.'],
    ],
  },
  'wholesale-private-label':{
    title:'Denim Fabric Sourcing & Custom Development',eyebrow:'Mill support from brief to bulk',
    intro:'Source core mill qualities or develop a custom denim construction around your composition, weight, stretch, shade, finish and cost targets.',image:'/fabric/hero-denim-mill.png',
    sections:[
      ['Start with the fabric brief','Share end use, composition, target oz or GSM, width, stretch, shade, finish, testing, order meters and delivery window. A reference swatch is especially useful.'],
      ['Select core or custom quality','Start from an existing mill standard for speed, or review custom yarn, weave, dye and finish feasibility. Custom development has separate sample, MOQ, cost and timing requirements.'],
      ['Approve swatches and data','Hand feel, shade, wash-down, physical performance, price, MOQ, packing and commercial terms are aligned before the bulk order.'],
      ['Produce and ship','Production follow-up, lot testing, roll inspection, shade grouping, packing documents and export coordination remain connected through shipment.'],
    ],
  },
  'quality-and-care':{
    title:'Fabric Quality Control & Bulk Assurance',eyebrow:'Protect the approved fabric standard',
    intro:'Lot-level controls connect composition, weight, width, shade, shrinkage, skew, strength and packing to the approved quality sheet.',image:'/fabric/specialty-range.png',
    sections:[
      ['Control the approved standard','Bulk production follows the signed swatch, shade reference, construction and agreed technical specification. Material changes require buyer approval.'],
      ['Inspect fabric-specific points','Checks can cover four-point inspection, usable width, GSM, shade grouping, shrinkage, skew, tensile or tear strength, stretch and recovery, crocking and colorfastness.'],
      ['Close findings before release','Results and corrective actions are reviewed before shipment when required. Final sampling scope, test methods, limits and remedies are agreed per order.'],
    ],
  },
};
