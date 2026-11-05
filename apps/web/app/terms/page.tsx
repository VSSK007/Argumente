import { LegalPage } from "@/components/Legal";

export const metadata = { title: "Terms · Argumenté" };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="2 November 2026">
      <h2>What this is</h2>
      <p>Argumenté is a tool for talking through disagreements and shared decisions. The Mediator and Delegates are AI. They can be wrong, and nothing they say is professional, medical, legal or financial advice.</p>

      <h2>Who can use it</h2>
      <ul>
        <li>You must be 18 or older.</li>
        <li>One account per person. Don’t create accounts to vote more than once or to pose as someone else.</li>
      </ul>

      <h2>How to behave</h2>
      <ul>
        <li>Don’t harass, threaten or pressure anyone. Don’t use a Chamber to monitor or control another person.</li>
        <li>Don’t put other people’s private information in public topics or published Maps.</li>
        <li>Delegates speak <em>about</em> you, never as you, and can’t make commitments for you. Don’t try to make one impersonate someone.</li>
        <li>We may remove public content, suspend a Delegate or close an account that breaks these rules. Moderators’ actions are logged.</li>
      </ul>

      <h2>Agreements</h2>
      <p>“Approved” inside Argumenté means everyone involved tapped approve. It is a record of what you agreed, not a legal contract, and no money moves through the app.</p>

      <h2>If this is a hard situation</h2>
      <p>If you’re afraid of someone, or worried about your safety or someone else’s, contact local emergency services or a helpline rather than using this tool. Argumenté pauses and shows resources when it sees signs of this, but it cannot intervene on your behalf.</p>

      <h2>No warranty</h2>
      <p>The service is provided as it is, may change or be unavailable, and our liability is limited to the extent the law allows. <em>[Jurisdiction and operator details to be added by the operator, after legal review.]</em></p>
    </LegalPage>
  );
}
