import { Link } from 'react-router-dom';

const entity = import.meta.env.VITE_LEGAL_ENTITY_NAME || 'Curva Fabric';
const email = import.meta.env.VITE_PRIVACY_EMAIL || 'curva88820@gmail.com';
const address = import.meta.env.VITE_LEGAL_POSTAL_ADDRESS || 'The business address shown on our formal quotation or invoice';
const effective = 'September 9, 2026';

function Page({ eyebrow, title, children }) {
  return <div className="min-h-screen bg-[#f8f4ec] px-5 pb-20 pt-32"><article className="mx-auto max-w-3xl rounded-3xl bg-white p-7 shadow-sm sm:p-12"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a84d33]">{eyebrow}</p><h1 className="mt-3 font-heading text-4xl font-bold text-[#17251f]">{title}</h1><p className="mt-2 text-sm text-[#6a756f]">Effective {effective}</p><div className="prose prose-slate mt-9 max-w-none leading-7 text-[#4d5953]">{children}</div></article></div>;
}

export function PrivacyPolicy() {
  return <Page eyebrow="Legal" title="Privacy Notice">
    <p>{entity} operates this B2B fabric inquiry website. This notice explains how we handle information when you browse, create an account, request a quote, or use buyer support.</p>
    <h2>Information we collect</h2><p>We collect a browser visitor ID; account and profile details; company, contact, quote, RFQ and chat content; consent records; and limited device, security and usage data such as page events, user agent and a one-way hash of an IP address. Please do not send passwords, payment-card data, government IDs, health data, or other sensitive information in chat or inquiry fields.</p>
    <h2>How we use information</h2><p>We use it to operate and secure the site, associate activity across browser visits you link to the same account, answer inquiries, prepare quotations, provide support, maintain records, prevent abuse, comply with law, and send optional marketing only where you have chosen it.</p>
    <h2>Who receives information</h2><p>We disclose information to personnel and service providers that help with hosting, databases, security and buyer communications. Support or high-intent messages may be delivered to our sales team through Lark. Providers may process information in other countries. We may also disclose information for legal compliance, safety, corporate transactions, or with your direction. We do not currently sell personal information or share it for cross-context behavioral advertising.</p>
    <h2>Retention and security</h2><p>Behavior events are normally retained for 180 days, guest support messages for 90 days, and resolved support conversations for 365 days, unless a longer period is needed for an active transaction, security, disputes, tax, customs, or legal obligations. We use access controls, password hashing, transport security in production, rate limits and audit records, but no system is completely secure.</p>
    <h2>Your choices and rights</h2><p>Depending on where you live, you may request access, correction, deletion, portability, or restriction and may opt out of marketing or sale/sharing. Use our <Link to="/privacy-choices">Privacy Choices</Link> page or contact <a href={`mailto:${email}`}>{email}</a>. We may verify your identity and may retain information that law permits or requires.</p>
    <h2>Business users and updates</h2><p>This service is intended for people at least 18 years old acting for a business, not children or consumer purchases. We may update this notice and will post the revised date here.</p>
    <h2>Contact</h2><p>{entity}<br />{address}<br /><a href={`mailto:${email}`}>{email}</a></p>
  </Page>;
}

export function TermsOfUse() {
  return <Page eyebrow="Legal" title="Terms of Use">
    <p>These terms govern access to this website. By using it, you represent that you are at least 18, are acting for a business, and have authority to bind that business. If you disagree, do not use the service.</p>
    <h2>Website and accounts</h2><p>Product pages, samples, availability and pricing are informational and are not an offer or purchase contract. Keep account credentials confidential, provide accurate information, and promptly report unauthorized use. We may suspend access needed to protect users, systems or legal compliance.</p>
    <h2>Acceptable use</h2><p>Do not misuse the site, probe security, scrape at disruptive volume, upload unlawful or infringing material, impersonate others, send malware or spam, or use the service in violation of trade, sanctions, export-control, privacy or other applicable law.</p>
    <h2>Support and third parties</h2><p>Automated assistance can be incomplete and is not a binding quotation. Human representatives are identified when they join. The service relies on third-party infrastructure and communications providers; their availability is not guaranteed.</p>
    <h2>Intellectual property</h2><p>The site and its content are owned by {entity} or licensors. You retain rights in material you submit and grant us a limited license to process it to operate the service and respond to your request.</p>
    <h2>Disclaimers and liability</h2><p>To the fullest extent permitted by law, the site is provided “as is” without implied warranties. {entity} is not liable for indirect, incidental, special, consequential or lost-profit damages arising from website use. Terms in an accepted quotation, order confirmation or written contract control any sale and may contain different warranties and liability limits.</p>
    <h2>Law, changes and contact</h2><p>The governing law and dispute terms stated in an accepted quotation or contract control transaction disputes. For website-only disputes, applicable conflict-of-law rules determine governing law. We may update these terms prospectively. Questions: <a href={`mailto:${email}`}>{email}</a>.</p>
  </Page>;
}

export function TermsOfSale() {
  return <Page eyebrow="B2B transactions" title="Standard Sales Terms">
    <p>These standard terms apply only when a quotation, proforma invoice, order confirmation or signed agreement issued by {entity} incorporates them. Any conflicting buyer terms are rejected unless expressly accepted in writing.</p>
    <h2>Quotes, specifications and samples</h2><p>Website information is nonbinding. A written quotation states price, currency, quantity, MOQ, validity, payment, lead time and delivery terms. Buyer must approve construction, composition, weight, color, finish, performance criteria and lab dips or samples. Commercial fabric can have reasonable shade, weight, width, stretch and lot variation within agreed tolerances.</p>
    <h2>Price, payment and delivery</h2><p>Taxes, duties, testing, packing, banking, insurance and freight are excluded unless stated. Payment and Incoterms® 2020 rules are those in the accepted quotation. Delivery dates are estimates unless expressly guaranteed; title and risk transfer under the stated delivery term.</p>
    <h2>Inspection and claims</h2><p>Buyer must inspect promptly and preserve evidence. Visible shortage or defect claims must be made within the period stated in the quotation and before cutting or processing. Hidden-defect claims must be made promptly after discovery. Use, cutting, washing or resale may constitute acceptance where the defect should reasonably have been found.</p>
    <h2>Compliance and buyer responsibility</h2><p>Each party must comply with applicable trade, sanctions, anti-bribery and import/export law. Buyer is responsible for final garment design, labeling, intended-use testing and market-specific compliance unless the written order assigns a requirement to {entity}. Sustainability or certification claims apply only when expressly documented for the relevant lot.</p>
    <h2>Remedies, delay and disputes</h2><p>Subject to mandatory law and the accepted order, the remedy for proven nonconforming fabric is repair, replacement or refund of the affected fabric value. Neither party is liable for delay caused by events beyond reasonable control. Governing law, forum, arbitration, warranty and liability provisions in the accepted quotation or signed contract control.</p>
    <p>Request the complete transaction terms before placing an order: <a href={`mailto:${email}`}>{email}</a>.</p>
  </Page>;
}
