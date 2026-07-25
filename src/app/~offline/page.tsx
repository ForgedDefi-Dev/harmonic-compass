import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <div className="offline-mark" aria-hidden="true">
        HC
      </div>
      <p className="eyebrow">Harmonic Compass</p>
      <h1>The room is offline. Your music is not.</h1>
      <p>
        Reopen the app after one connected visit to keep Play, Build, Grow, and Library available
        here.
      </p>
      <Link className="primary-button" href="/">
        Try again
      </Link>
    </main>
  );
}
