import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks';

export function RefundPolicyPage() {
  useDocumentTitle('Refund Policy');
  return (
    <div className="wrap page prose">
      <h1>Refund Policy</h1>
      <p className="lead">Maua Marketplace is a free classifieds platform. Buyers and sellers arrange transactions directly with each other; Maua Marketplace does not collect or hold purchase money.</p>
      <p><strong>Effective date:</strong> 19 October 2026</p>
      <h2>1. Marketplace fees</h2>
      <p>At the effective date, browsing and posting listings are free. Because the platform does not charge a listing or transaction fee, there is no marketplace fee to refund.</p>
      <h2>2. Purchases between members</h2>
      <p>Maua Marketplace is not the seller, payment provider, escrow agent or delivery service for member-to-member sales. We cannot refund money paid directly to a seller, reverse a transfer, or guarantee that a seller will reimburse a buyer. Buyers should inspect goods and agree on payment, delivery and returns with the seller before paying.</p>
      <h2>3. Disputes, scams and unsafe listings</h2>
      <p>If you suspect fraud or a prohibited listing, stop communicating if needed and report the listing or member through the app. If you paid through a bank, mobile-money provider or other payment service, contact that provider promptly to ask whether its dispute or reversal process applies. You may also report suspected criminal conduct to the relevant authorities.</p>
      <h2>4. Legal rights</h2>
      <p>Nothing in this policy removes consumer rights or remedies that cannot legally be excluded under applicable Kenyan law. This policy does not decide disputes between a buyer and seller.</p>
      <h2>5. Contact</h2>
      <p>For platform-related questions, use the contact details published on the Maua Marketplace website. For privacy matters, see our <Link to="/privacy">Privacy Policy</Link>. For platform rules, see the <Link to="/terms">Terms and Conditions</Link>.</p>
    </div>
  );
}
