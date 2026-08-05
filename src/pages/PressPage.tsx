import { Link } from "wouter";
import { Header, Footer } from "@/components/layout/Shell";
import { PRESS_RELEASES } from "@/lib/pressReleases";
import { ArrowRight } from "lucide-react";

export default function PressPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground selection:bg-primary/20">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mb-12 border-b border-border pb-8">
          <span className="font-mono-data text-muted-foreground">NEWSROOM</span>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight mt-2 mb-4">
            Press Releases
          </h1>
          <p className="text-lg text-muted-foreground font-serif italic leading-relaxed">
            News uncovered by Hollywood Sales Wire's monitoring of government
            registries, tax-credit award lists, and hiring signals — reported
            here before it reaches the trades.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {PRESS_RELEASES.map((release) => (
            <Link
              key={release.slug}
              href={`/press/${release.slug}`}
              className="group block"
              data-testid={`link-press-${release.slug}`}
            >
              <article>
                <div className="font-mono-data text-muted-foreground mb-2">
                  {new Date(release.datePublished + "T12:00:00").toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
                <h2 className="text-2xl font-serif font-bold tracking-tight mb-2 group-hover:text-primary transition-colors">
                  {release.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  {release.description}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read the release
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </article>
            </Link>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
