import { Link, useParams } from "wouter";
import { useEffect } from "react";
import { Header, Footer } from "@/components/layout/Shell";
import { getPressRelease } from "@/lib/pressReleases";
import NotFound from "@/pages/not-found";
import { ArrowLeft } from "lucide-react";

export default function PressReleasePage() {
  const { slug } = useParams<{ slug: string }>();
  const release = getPressRelease(slug ?? "");

  useEffect(() => {
    if (release) {
      const prev = document.title;
      document.title = `${release.title} — Hollywood Sales Wire`;
      return () => {
        document.title = prev;
      };
    }
    return undefined;
  }, [release]);

  if (!release) return <NotFound />;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: release.title,
    description: release.description,
    datePublished: release.datePublished,
    mainEntityOfPage: `https://hollywoodsaleswire.com/press/${release.slug}`,
    author: { "@type": "Organization", name: "Hollywood Sales Wire" },
    publisher: { "@type": "Organization", name: "Hollywood Sales Wire", url: "https://hollywoodsaleswire.com" },
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground selection:bg-primary/20">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <Link
          href="/press"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
          data-testid="link-back-to-press"
        >
          <ArrowLeft className="w-4 h-4" />
          All press releases
        </Link>

        <div className="mb-10 border-b border-border pb-8">
          <div className="font-mono-data text-muted-foreground mb-3">
            FOR IMMEDIATE RELEASE ·{" "}
            {new Date(release.datePublished + "T12:00:00")
              .toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })
              .toUpperCase()}
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-serif font-bold leading-[1.1] tracking-tight text-balance">
            {release.title}
          </h1>
        </div>

        <article className="prose prose-lg prose-zinc max-w-none prose-p:leading-[1.8] prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-strong:font-bold prose-strong:text-foreground">
          {release.body.map((block, i) =>
            block.type === "h2" ? (
              <h2 key={i} className="text-2xl mt-12 mb-4">
                {block.text}
              </h2>
            ) : (
              <p key={i}>
                {i === 0 && <strong>{release.dateline} — </strong>}
                {block.text}
              </p>
            ),
          )}
          <p>
            <strong>Media contact:</strong> {release.mediaContact}
          </p>
        </article>
      </main>
      <Footer />
    </div>
  );
}
