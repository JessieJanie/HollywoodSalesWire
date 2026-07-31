import { Link, useParams } from "wouter";
import { useEffect } from "react";
import { Header, Footer } from "@/components/layout/Shell";
import { getArticle } from "@/lib/articles";
import NotFound from "@/pages/not-found";
import { ArrowLeft, ArrowRight } from "lucide-react";

export default function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = getArticle(slug ?? "");

  useEffect(() => {
    if (article) {
      const prev = document.title;
      document.title = `${article.title} — Hollywood Sales Wire`;
      return () => {
        document.title = prev;
      };
    }
    return undefined;
  }, [article]);

  if (!article) return <NotFound />;

  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground selection:bg-primary/20">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <Link
          href="/articles"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-8"
          data-testid="link-back-to-articles"
        >
          <ArrowLeft className="w-4 h-4" />
          All articles
        </Link>

        <div className="mb-10 border-b border-border pb-8">
          <div className="font-mono-data text-muted-foreground mb-3">
            {new Date(article.datePublished + "T12:00:00").toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}{" "}
            · {article.readMinutes} MIN READ · BY KARILYN COLEGROVE
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-[2.75rem] font-serif font-bold leading-[1.1] tracking-tight text-balance">
            {article.title}
          </h1>
        </div>

        {article.heroImage && (
          <img
            src={`${import.meta.env.BASE_URL}${article.heroImage}`}
            alt={article.heroImageAlt ?? ""}
            className="w-full mb-10 border border-border"
            data-testid="img-article-hero"
          />
        )}

        <article className="prose prose-lg prose-zinc max-w-none prose-p:leading-[1.8] prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-strong:font-bold prose-strong:text-foreground">
          {article.body.map((block, i) =>
            block.type === "h2" ? (
              <h2 key={i} className="text-2xl mt-12 mb-4">
                {block.text}
              </h2>
            ) : (
              <p key={i}>{block.text}</p>
            ),
          )}
        </article>

        <div className="mt-16 border border-border p-6 sm:p-8 bg-muted/30">
          <span className="font-mono-data text-muted-foreground">THE WEEKLY BRIEFING</span>
          <h3 className="text-xl font-serif font-bold tracking-tight mt-2 mb-2">
            Want the signals read for you?
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Hollywood Sales Wire reports the entertainment industry's live buying signals every
            Tuesday — who just got funded, what they're about to buy, and when the window closes.
          </p>
          <Link
            href="/order"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
            data-testid="link-article-cta"
          >
            Become a Member
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
