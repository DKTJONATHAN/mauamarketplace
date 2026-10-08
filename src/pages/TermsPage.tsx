import { useDocumentTitle } from '../hooks';

export function TermsPage() {
  useDocumentTitle('Terms and Conditions');

  return (
    <div className="wrap page prose">
      <h1>Terms and Conditions</h1>
      <p className="lead">
        These Terms and Conditions govern your use of Maua Marketplace. By creating an account or using features that require
        acceptance of the terms, you agree to follow these rules.
      </p>
      <p><strong>Effective date:</strong> 8 October 2026</p>

      <h2>1. About the service</h2>
      <p>
        Maua Marketplace is an online notice board that helps people advertise goods and lawful services and communicate directly.
        We are not the seller, buyer, agent, broker, delivery company, payment processor or guarantor for any transaction.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and legally able to enter into agreements. You are responsible for ensuring that your
        use of the service is lawful in Kenya and in the place where you are located.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>Provide accurate information and keep your account credentials secure.</li>
        <li>Do not impersonate another person or create an account for someone else without permission.</li>
        <li>Do not share your password, authentication links or account access.</li>
        <li>You are responsible for activity performed through your account, except where caused by a security failure outside your reasonable control.</li>
      </ul>

      <h2>4. Listings</h2>
      <p>When you post a listing, you represent that:</p>
      <ul>
        <li>you have the right to advertise and sell or provide what you describe;</li>
        <li>your description, price, condition and other material information are honest and not misleading;</li>
        <li>your photos are yours to use and do not unlawfully infringe another person's rights;</li>
        <li>the listing complies with Kenyan law and these Terms; and</li>
        <li>you will deal with interested people honestly and safely.</li>
      </ul>

      <h2>5. Prohibited content and activity</h2>
      <ul>
        <li>Illegal goods or services, stolen goods, counterfeit goods or fraud.</li>
        <li>Weapons, ammunition, explosives and other prohibited or highly regulated goods.</li>
        <li>Illegal drugs, unlawful prescription-drug sales and controlled substances.</li>
        <li>Protected wildlife or wildlife products traded unlawfully.</li>
        <li>Sexual or adult services and exploitative content.</li>
        <li>Human trafficking, organs, exploitation, scams or advance-fee schemes.</li>
        <li>Harassment, threats, hate, doxxing, impersonation or abuse.</li>
        <li>Spam, duplicate listings, malware, attempts to bypass security or attempts to access another person's account.</li>
        <li>Listings intended to deceive people about the identity, quality, availability or ownership of an item.</li>
      </ul>

      <h2>6. Transactions are between users</h2>
      <p>
        Maua Marketplace does not collect purchase money, hold deposits, process sales, provide escrow, arrange delivery or issue
        refunds. We do not guarantee the quality, safety, legality, authenticity, ownership, availability or suitability of a
        listing or seller.
      </p>
      <p>
        Before paying, inspect the item, confirm the seller and agree on the transaction yourself. Meet in a busy public place
        where appropriate. Never share one-time passwords, passwords or sensitive identity information with another member.
      </p>

      <h2>7. Fees</h2>
      <p>
        The marketplace is currently free to post listings and browse listings. If fees are introduced for a feature in future,
        the applicable price and terms will be shown before you are charged.
      </p>

      <h2>8. Reports, moderation and removal</h2>
      <p>
        Members may report listings or accounts. We may hide, restrict or remove content and accounts that appear to violate these
        Terms, the Rules, applicable law or the safety of the community. Automated or member reports may trigger temporary
        restrictions while a matter is reviewed.
      </p>

      <h2>9. Intellectual property</h2>
      <p>
        You retain rights in content you lawfully own. By submitting a listing, you give Maua Marketplace permission to host,
        reproduce, resize, display and technically process that content as necessary to operate, secure and promote the listing
        within the service. You must not upload content you do not have permission to use.
      </p>

      <h2>10. Third-party services</h2>
      <p>
        Parts of the service depend on third-party infrastructure such as Supabase, Cloudflare and authentication providers.
        Availability and processing may therefore depend on those providers. Their separate terms may also apply to their services.
      </p>

      <h2>11. Availability and changes</h2>
      <p>
        We may modify, suspend or discontinue features, including for security, maintenance, legal compliance or technical
        reasons. We do not guarantee that the marketplace will always be available, error-free or free from harmful third-party
        activity.
      </p>

      <h2>12. No warranties</h2>
      <p>
        To the extent permitted by law, the service is provided on an “as available” basis without a guarantee that listings,
        members or transactions will meet your expectations. Nothing in these Terms excludes a right or liability that cannot
        lawfully be excluded under Kenyan law.
      </p>

      <h2>13. Limitation of responsibility</h2>
      <p>
        To the maximum extent permitted by applicable law, Maua Marketplace is not responsible for losses arising from a private
        transaction between members, including payment disputes, defective goods, non-delivery, inaccurate listings, fraud or
        conduct of another member. This does not exclude liability where exclusion is prohibited by law.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        To the extent permitted by law, you agree to take responsibility for claims, losses or costs caused by your unlawful use
        of the service, your breach of these Terms or content that you upload without the necessary rights.
      </p>

      <h2>15. Account suspension and termination</h2>
      <p>
        We may suspend or terminate access where necessary to protect users, investigate abuse, enforce these Terms or comply with
        law. You may stop using the service at any time and may delete your account through the Account page.
      </p>

      <h2>16. Privacy</h2>
      <p>
        Our <a href="#/privacy">Privacy Policy</a> explains how personal information is processed. By using the service, you
        acknowledge that you have been given access to that policy.
      </p>

      <h2>17. Governing law</h2>
      <p>
        These Terms are governed by the laws of Kenya, subject to any mandatory consumer, privacy or other legal protections that
        apply to you. Disputes should first be raised with the marketplace operator where practical, without limiting any right
        to seek a remedy through a competent Kenyan authority or court.
      </p>

      <h2>18. Changes to these Terms</h2>
      <p>
        We may update these Terms when the service or law changes. Material changes will be reflected by a new effective date.
        Continued use after the updated terms become effective constitutes acceptance to the extent permitted by law.
      </p>
    </div>
  );
}
