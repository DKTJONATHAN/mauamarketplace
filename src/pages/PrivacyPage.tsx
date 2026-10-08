import { useDocumentTitle } from '../hooks';

export function PrivacyPage() {
  useDocumentTitle('Privacy Policy');

  return (
    <div className="wrap page prose">
      <h1>Privacy Policy</h1>
      <p className="lead">
        This Privacy Policy explains how Maua Marketplace collects, uses, stores and protects personal information when you use
        the marketplace.
      </p>
      <p><strong>Effective date:</strong> 8 October 2026</p>

      <h2>1. Who this policy applies to</h2>
      <p>
        This policy applies to visitors, members, sellers and buyers who use Maua Marketplace. Maua Marketplace is a community
        classifieds platform for Maua, Meru County and surrounding areas. We aim to process personal information lawfully,
        fairly, transparently and only for purposes connected with operating the service.
      </p>

      <h2>2. Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> email address, authentication information and your chosen display name.</li>
        <li><strong>Listing information:</strong> titles, descriptions, prices, categories, location information you provide, photos and optional phone numbers.</li>
        <li><strong>Marketplace activity:</strong> saved listings, blocked members, reports, conversations and messages.</li>
        <li><strong>Technical information:</strong> information necessary for authentication, security, troubleshooting and reliable delivery of the service, which may include browser, device and network information handled by our infrastructure providers.</li>
        <li><strong>Local device storage:</strong> your browser may keep a login session, PWA installation state and small interface preferences.</li>
      </ul>

      <h2>3. How we use information</h2>
      <ul>
        <li>To create and authenticate accounts.</li>
        <li>To publish and display listings and seller information that you choose to make public.</li>
        <li>To allow members to communicate about listings.</li>
        <li>To provide saved listings, blocking, reporting and account-management features.</li>
        <li>To detect abuse, fraud, spam, threats and violations of our rules.</li>
        <li>To maintain security, troubleshoot problems and improve the reliability of the marketplace.</li>
        <li>To comply with applicable legal obligations and respond to lawful requests.</li>
      </ul>

      <h2>4. Lawful basis</h2>
      <p>
        Depending on the activity, processing may be based on your consent, the performance of an agreement with you, compliance
        with a legal obligation, protection of vital interests, or legitimate interests that do not override your rights and
        freedoms. We do not use personal information for unrelated purposes simply because it was collected for another service
        function.
      </p>

      <h2>5. What is public</h2>
      <p>
        Your display name, member-since information, listings and listing photos are visible to visitors. A phone number attached
        to a listing is available only through the authenticated contact flow. Your email address is not displayed to other
        members. Messages are private to the participants in a conversation, but they are not end-to-end encrypted.
      </p>
      <p>
        Do not publish passwords, PINs, national ID numbers, financial account details, private addresses or other sensitive
        information in a listing or message.
      </p>

      <h2>6. Photos and public media</h2>
      <p>
        Listing photos are stored on infrastructure used to serve public marketplace images. Photos should contain only material
        you are comfortable making public. Remove identifying information such as documents, house numbers or private paperwork
        before uploading. We may process images to validate file type and protect the service from abusive uploads.
      </p>

      <h2>7. Service providers</h2>
      <p>
        We use third-party infrastructure providers to operate the service, including Supabase for authentication, database
        services and related backend functions, and Cloudflare for website hosting, application functions and media delivery.
        Google may process authentication information if you choose Google sign-in. These providers process information only as
        needed to provide their services, subject to their own terms and privacy practices.
      </p>

      <h2>8. International transfers</h2>
      <p>
        Some infrastructure providers may process or store information outside Kenya. Where personal information is transferred
        outside Kenya, we seek appropriate safeguards and a lawful basis consistent with applicable Kenyan data-protection
        requirements.
      </p>

      <h2>9. Retention</h2>
      <p>
        We retain information only for as long as reasonably necessary for the purpose for which it was collected, to operate
        the service, prevent abuse, resolve disputes, maintain security, or satisfy legal obligations. Exact retention periods can
        vary by information type and legal requirements.
      </p>

      <h2>10. Your data-protection rights</h2>
      <p>Subject to applicable law, you may have rights to:</p>
      <ul>
        <li>be informed about how your personal data is used;</li>
        <li>access personal data held about you;</li>
        <li>request correction of inaccurate or misleading information;</li>
        <li>request deletion or erasure where the law permits;</li>
        <li>object to certain processing;</li>
        <li>request restriction of processing in appropriate circumstances;</li>
        <li>request portability where applicable; and</li>
        <li>withdraw consent where processing is based on consent.</li>
      </ul>
      <p>
        You can delete your Maua Marketplace account from the Account page when signed in. Account deletion is designed to remove
        your profile, listings, saved items, conversations and associated photos from the active service. Backups, security logs or
        records that must be retained by law may remain for the applicable retention period.
      </p>

      <h2>11. Security</h2>
      <p>
        We use technical and organisational measures intended to protect personal information, including authenticated access
        controls, database access policies, server-side handling of privileged operations and protected connections. No internet
        service can guarantee absolute security, so please avoid sending highly sensitive information through marketplace messages.
      </p>

      <h2>12. Children</h2>
      <p>
        Maua Marketplace is intended for adults aged 18 and over. Do not create an account or use the marketplace if you are under
        18. If we learn that an account belongs to a person under 18, we may restrict or remove it.
      </p>

      <h2>13. Cookies and similar technologies</h2>
      <p>
        The application uses browser storage and authentication mechanisms needed to keep you signed in and remember limited
        preferences. We do not intentionally use advertising cookies or sell personal information to advertisers.
      </p>

      <h2>14. Data breaches and complaints</h2>
      <p>
        If a security incident creates a risk to your personal information, we will assess it and take steps required by
        applicable law, including notification where legally required. If you have a privacy concern, use the account controls
        available on the site or contact the marketplace operator through the support channel made available with the service.
        You may also contact the Office of the Data Protection Commissioner in Kenya if you believe your data-protection rights
        have been infringed.
      </p>

      <h2>15. Changes to this policy</h2>
      <p>
        We may update this Privacy Policy when the service, law or data practices change. The effective date at the top will be
        updated when material changes are made. Continued use after an update means you have had an opportunity to review the
        revised policy.
      </p>

      <h2>16. Governing framework</h2>
      <p>
        This policy is intended to operate consistently with the Constitution of Kenya, the Data Protection Act, 2019 and
        applicable regulations and guidance. It does not remove any mandatory rights or protections provided by law.
      </p>
    </div>
  );
}
