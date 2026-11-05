import { LegalPage } from "@/components/Legal";

export const metadata = { title: "Privacy · Argumenté" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy" updated="2 November 2026">
      <p>Argumenté helps people understand each other’s disagreements. That means it holds sensitive things, so this page says plainly what it keeps, who can see it, and how to take it back.</p>

      <h2>What we keep</h2>
      <ul>
        <li><strong>Account:</strong> your name and email, whether the email is verified, and passkeys you add (we store only a public key).</li>
        <li><strong>Your Delegate and what it knows:</strong> positions you endorsed, their scope (private, public, or locked to one Chamber), and the history of edits. You can see, edit and retract all of it in Me.</li>
        <li><strong>Chambers you take part in:</strong> your positions, how they were explained back to you, rankings, predictions, steelmen, agreements, and a record of events.</li>
        <li><strong>Public topics:</strong> statements and votes. Votes and authors are never shown to anyone; we use them only to draw the opinion map.</li>
        <li><strong>Operational data:</strong> sign-in links (stored hashed), sessions, rate-limit counters, reports, and moderator audit logs.</li>
      </ul>

      <h2>Who can see what</h2>
      <ul>
        <li><strong>Other people in a Chamber</strong> see how your view was explained <em>after you accepted it</em>, agreements you approved, and aggregate results. They never see your exact words, your individual option ranking, your individual Understanding Score, or a sealed prediction before a revisit.</li>
        <li><strong>Your Delegate</strong> only uses positions you endorsed. In a Chamber it only uses what you endorsed there. Others can talk with it (a rehearsal) only if you opt in, and then only your public positions.</li>
        <li><strong>The public</strong> sees a Map only after every participant consents, with names replaced unless everyone chooses otherwise. You can withdraw consent and it comes down.</li>
        <li><strong>Moderators</strong> see public content that has been reported, plus the reason. They are not given access to private Chambers or Spar sessions, and every moderation action is logged.</li>
        <li><strong>The team</strong> sees aggregate metrics (counts and averages) and any feedback note you choose to write.</li>
      </ul>

      <h2>AI processing</h2>
      <p>When this service is configured with an AI provider key, the text needed for a step (for example, the positions in a Chamber) is sent to that provider to produce the analysis, and the result is shown back to you. Without a key, analysis runs on the server with simple rules and nothing is sent to an AI provider. We do not sell your data, show advertising, or use private Chamber content to train models.</p>

      <h2>How long we keep it</h2>
      <ul>
        <li>A closed Chamber’s private content (positions, restatements, Map, steelmen, quiz answers, evidence, predictions) is deleted 90 days after it closes, unless someone chooses to keep it longer.</li>
        <li>Agreements, consented published Maps and positions you chose to keep in your Delegate stay until you remove them or delete your account.</li>
        <li>Sign-in sessions last 30 days.</li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li><strong>Export</strong> everything tied to your account, or <strong>delete</strong> your account, from Me. Deleting removes your account, Delegate and positions.</li>
        <li><strong>Emails:</strong> we email only to sign you in and, if you leave it on, to tell you it’s your turn (at most one every 30 minutes, never repeating what anyone wrote). Switch that off in your Inbox.</li>
        <li><strong>Pause or delete</strong> your Delegate whenever you like.</li>
      </ul>

      <h2>Safety</h2>
      <p>Text people write is checked automatically for signs of abuse, coercion or self-harm. If something is flagged, only the person who wrote it is shown help resources, and the Chamber pauses without telling anyone why. Argumenté is not therapy, legal advice or a crisis service, and it is for people aged 18 and over.</p>

      <h2>Contact</h2>
      <p>Questions or requests: <em>[operator name and contact email to be added]</em>.</p>
    </LegalPage>
  );
}
