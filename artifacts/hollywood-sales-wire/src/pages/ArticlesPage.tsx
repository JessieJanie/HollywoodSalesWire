import { Link } from "wouter";
import { Header, Footer } from "@/components/layout/Shell";
import { ARTICLES } from "@/lib/articles";
import { ArrowRight } from "lucide-react";

export default function ArticlesPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground selection:bg-primary/20">
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mb-12 border-b border-border pb-8">
          <span className="font-mono-data text-muted-foreground">FROM THE WIRE</span>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight mt-2 mb-4">
            Articles
          </h1>
          <p className="text-lg text-muted-foreground font-serif italic leading-relaxed">
            Field notes on selling into the production economy — how funding, hiring, and timing signals reveal buyers before the lead lists do.
          </p>
        </div>

        <div className="flex flex-col gap-10">
          {ARTICLES.map((article) => (
            <Link
              key={article.slug}
              href={`/articles/${article.slug}`}
              className="group block"
              data-testid={`link-article-${article.slug}`}
            >
              <article>
                {article.heroImage && (
                  <img
                    src={`${import.meta.env.BASE_URL}${article.heroImage}`}
                    alt={article.heroImageAlt ?? ""}
                    className="w-full mb-4 border border-border"
                    data-testid={`img-article-thumb-${article.slug}`}
                  />
                )}
                <div className="font-mono-data text-muted-foreground mb-2">
                  {new Date(article.datePublished + "T12:00:00").toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}{" "}
                  · {article.readMinutes} MIN READ
                </div>
                <h2 className="text-2xl font-serif font-bold tracking-tight mb-2 group-hover:text-primary transition-colors">
                  {article.title}
                </h2>
                <p className="text-muted-foreground leading-relaxed mb-3">{article.description}</p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Read the article
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
