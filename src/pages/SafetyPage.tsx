import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks';

export function SafetyPage() {
  useDocumentTitle('Safety tips');
  return (
    <div className="wrap page prose">
      <h1>Safety tips</h1>
      <p className="lead">
        Nobody checks the people or items on this site, so a little care protects you. Most problems come from paying too early
        or meeting in the wrong place.
      </p>

      <h2>Before you meet</h2>
      <ul>
        <li>Chat in the app first. You do not need to share your phone number to ask questions.</li>
        <li>Meet in a busy public place in daylight, such as a shopping centre, a petrol station or near a police post. Avoid isolated spots and private homes.</li>
        <li>Tell a friend or relative where you are going and who you are meeting. Bring someone along for big purchases.</li>
        <li>Do not share your home address, ID number or bank details. If a seller insists on them, walk away.</li>
        <li>If anything feels wrong, leave. A missed deal costs less than a bad one.</li>
      </ul>

      <h2>Paying safely</h2>
      <ul>
        <li>Inspect the item and test it before you pay. Pay when it is in your hands.</li>
        <li>Never pay a deposit, booking fee, transport fee, "verification" fee or "insurance" to someone you have not met.</li>
        <li>An M-Pesa confirmation SMS can be faked. Check your own M-Pesa balance or statement before you hand over an item.</li>
        <li>Be wary of anyone who says they sent you money by mistake and asks you to send it back. Check your balance first, and contact your mobile network if unsure.</li>
        <li>Never tell anyone your M-Pesa PIN, bank PIN or any code sent to your phone. Nobody legitimate will ask for it.</li>
        <li>For large amounts, pay by bank transfer or through an advocate, not in cash.</li>
      </ul>

      <h2>Phones and electronics</h2>
      <ul>
        <li>Dial *#06# on the phone and check the IMEI matches the box and the settings screen.</li>
        <li>Ask for the receipt or proof of ownership. Cheap goods with no paperwork are sometimes stolen.</li>
        <li>Make sure the previous owner's Google or Apple account is signed out, otherwise the phone may be locked later.</li>
        <li>Test calls, camera, charging, screen and speakers. For laptops, test the battery, keyboard and ports.</li>
      </ul>

      <h2>Vehicles and motorbikes</h2>
      <ul>
        <li>Ask for the original logbook and the seller's ID, and check the names match. Check that the chassis and engine numbers match the logbook.</li>
        <li>Do an official NTSA search on the registration number before paying.</li>
        <li>Take the vehicle to a mechanic you trust.</li>
        <li>Never pay a deposit to "hold" a vehicle, and be careful with prices that are far below the market or sellers who say they are abroad.</li>
        <li>Transfer ownership promptly after the sale.</li>
      </ul>

      <h2>Land and rentals</h2>
      <ul>
        <li>Do an official land search (Ardhisasa or the land registry) to confirm who owns a plot before you pay anything.</li>
        <li>Use an advocate for a sale agreement and pay through the advocate or the bank.</li>
        <li>For rentals, view the place and meet the owner or a genuine agent before paying a deposit. Ask for a written tenancy agreement.</li>
      </ul>

      <h2>House helps and jobs</h2>
      <ul>
        <li>Only adults aged 18 or over may be listed. Report anyone who looks underage.</li>
        <li>Employers: check the national ID, speak to previous employers or referees, and agree pay and duties in writing.</li>
        <li>Workers: meet first in a public place, tell someone where you are going, and keep your original ID and certificates. Never hand them over to anyone.</li>
        <li>Never pay a placement, registration or "processing" fee to get work.</li>
        <li>If you suspect child labour, trafficking or someone being held against their will, call the police on 999 or 112. The Child Helpline is 116.</li>
      </ul>

      <h2>Livestock and farm produce</h2>
      <ul>
        <li>See the animal or the produce in person before you pay, and agree the quantity, price and delivery first.</li>
        <li>For livestock, ask about ownership and any movement permit that applies, and check the animal's health.</li>
      </ul>

      <h2>Signs of a scam</h2>
      <ul>
        <li>The price is far too good to be true.</li>
        <li>The person cannot meet and wants to use a courier, an "agent" or a delivery fee.</li>
        <li>You are rushed, or told someone else is about to pay.</li>
        <li>You are sent a link or asked to move to another app before you have even met. The scam warnings in our chat only work inside the app.</li>
        <li>A buyer "overpays" and asks you to send back the difference.</li>
      </ul>

      <h2>If something goes wrong</h2>
      <ul>
        <li>Stop sending money. Keep screenshots of the messages and the listing.</li>
        <li>If you have paid, contact your mobile money provider or bank straight away.</li>
        <li>Report the listing or member with the Report button so others are protected.</li>
        <li>Report fraud, theft or threats to the nearest police station. In an emergency call 999 or 112.</li>
        <li>We cannot refund money or settle disputes, because we do not take part in deals.</li>
      </ul>

      <p><Link to="/rules">Marketplace rules and privacy</Link></p>
    </div>
  );
}
