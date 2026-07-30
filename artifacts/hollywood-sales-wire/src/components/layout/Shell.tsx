import { Link } from "wouter";
import { SUPPORT_EMAIL } from "@/lib/constants";

export function Header() {
  return (
    <header className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-6 h-6 bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-sm">
            H
          </div>
          <span className="font-serif font-semibold text-lg tracking-tight group-hover:opacity-80 transition-opacity">
            Hollywood Sales Wire
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          <Link
            href="/order"
            className="bg-primary text-primary-foreground px-4 py-2 font-medium hover:opacity-90 transition-opacity"
          >
            Become a Member
          </Link>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-12 mt-24">
      <div className="max-w-4xl mx-auto px-4 flex flex-col md:flex-row items-start justify-between gap-8">
        <div className="max-w-xs">
          <Link href="/" className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-xs">
              H
            </div>
            <span className="font-serif font-semibold text-base tracking-tight">
              Hollywood Sales Wire
            </span>
          </Link>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A premium direct-response subscription intelligence service. The trade's private ticker for the production economy.
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground mb-1">Navigation</span>
          <Link href="/" className="hover:text-foreground transition-colors">The Briefing</Link>
          <Link href="/articles" className="hover:text-foreground transition-colors">Articles</Link>
          <Link href="/order" className="hover:text-foreground transition-colors">Become a Member</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground mb-1">Legal</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          <Link href="/support" className="hover:text-foreground transition-colors">Support</Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-foreground transition-colors">{SUPPORT_EMAIL}</a>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 mt-12 pt-8 border-t border-border/50 text-xs text-muted-foreground flex justify-between items-center">
        <span>© {new Date().getFullYear()} Hollywood Sales Wire. All rights reserved.</span>
        <span className="font-mono-data">MEMBER-ONLY</span>
      </div>
    </footer>
  );
}
