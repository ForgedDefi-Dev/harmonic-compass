import { HarmonicCompassApp } from "@/components/harmonic-compass-app";

interface HomePageProps {
  searchParams: Promise<{ showcase?: string | string[] }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const { showcase } = await searchParams;
  return <HarmonicCompassApp initialShowcase={showcase === "1"} />;
}
