import { Link } from 'react-router-dom';
import { site } from '../config/site';
import { useDocumentTitle } from '../hooks';

export function RulesPage() {
  useDocumentTitle('Rules and privacy');
  return (
    <div className="wrap page prose">
      <h1>Rules and privacy</h1>
      <p className="lead">
        {site.name} is a free notice board for {site.place}, {site.region}. This page explains what is allowed, what we do and
        do not do, and what happens to your data.
      </p>

      <h2>What this site is</h2>
      <p>
        We provide a place for people to advertise things and talk to each other. We are not a party to any sale, hire or job.
        We do not verify members or items, hold or move money, deliver goods, offer refunds or settle disputes. Everything is
        provided as it is, and you deal with other people at your own risk. Please read the <Link to="/safety">safety tips</Link>.
      </p>

      <h2>Who can use it</h2>
      <p>You must be 18 or older. Members are responsible for what they post and for what they send in messages.</p>

      <h2 id="prohibited">What you may not post</h2>
      <ul>
        <li>Stolen goods, or anything you do not have the right to sell.</li>
        <li>Fake, counterfeit or misleadingly described items.</li>
        <li>Weapons, ammunition and explosives.</li>
        <li>Illegal drugs and prescription medicines.</li>
        <li>Protected wildlife and wildlife products.</li>
        <li>People or human organs. The house helps and jobs categories are only for genuine, lawful offers or requests for work by adults.</li>
        <li>Sexual or adult content or services.</li>
        <li>Anything that is illegal in Kenya, or that is meant to trick people, such as advance-payment schemes.</li>
        <li>Duplicate or spam listings, abuse, threats or harassment.</li>
      </ul>

      <h2>Reports and removals</h2>
      <p>
        Any signed-in member can report a listing or another member. When five different members report the same listing it is
        hidden automatically. The site owner may also remove listings or accounts that break these rules.
        {site.contactEmail && (
          <> To ask for something to be removed, email <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</>
        )}
      </p>

      <h2>Your privacy</h2>
      <h3>What we store</h3>
      <ul>
        <li>Your email address and a hashed password, or your Google sign-in link. Your email is used to log you in and is never shown to other members.</li>
        <li>Your display name, which you choose. We do not copy your name from Google.</li>
        <li>Your listings, photos and, if you add one, a phone number for each listing.</li>
        <li>Your messages, saved listings, the members you block and the reports you file.</li>
      </ul>
      <h3>Who can see what</h3>
      <ul>
        <li>Everyone can see your display name, the month you joined, and your listings, including photos.</li>
        <li>Phone numbers can only be seen by logged-in members who ask to see them on a listing.</li>
        <li>Messages can only be read by the two people in the conversation. They are not end-to-end encrypted, so the site operator could technically read them in the database. Do not send passwords, PINs or ID numbers.</li>
        <li>Reports can be seen by the site operator.</li>
      </ul>
      <h3>Photos are public</h3>
      <p>
        Listing photos are stored in a public GitHub repository so everyone can see them. Anyone can save a copy. Location data is
        removed from your photos before they are uploaded. When you delete a listing or account we remove the photos from the
        site, but GitHub may keep earlier versions in its history.
      </p>
      <h3>Deleting your data</h3>
      <p>You can delete your account in <Link to="/account">Account</Link>. That removes your profile, listings, saved items and conversations. You may also have rights under Kenya's Data Protection Act, 2019.</p>
      <h3>Services we rely on</h3>
      <p>
        Supabase stores accounts, listings and messages. GitHub hosts this website and the photos. Google is involved only if you
        choose to sign in with Google. We do not run ads or third-party trackers. Your browser keeps a sign-in session and a few
        small settings on your device.
      </p>
    </div>
  );
}
