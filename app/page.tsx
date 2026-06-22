import Nav from "./_components/Nav";
import Hero from "./_components/Hero";
import Features from "./_components/Features";
import Calendars from "./_components/Calendars";
import Privacy from "./_components/Privacy";
import Pricing from "./_components/Pricing";
import FinalCta from "./_components/FinalCta";
import Footer from "./_components/Footer";

// スカッと予定 ランディングページ。
export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Features />
        <Calendars />
        <Privacy />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
