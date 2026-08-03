import { Link } from "wouter";
import { Header, Footer } from "@/components/layout/Shell";
import { motion } from "framer-motion";
import { Mail, BookOpen } from "lucide-react";

export default function ThanksPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground">
      <Header />
      
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <div className="inline-block px-3 py-1 bg-primary text-primary-foreground font-mono-data font-bold tracking-widest mb-8">
            ORDER CONFIRMED
          </div>
          <h1 className="text-4xl sm:text-5xl font-serif font-bold tracking-tight mb-6">
            Welcome to the Wire.
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed font-serif italic">
            Your Founding Membership is confirmed. You are now locked in.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-card border-t-4 border-t-primary border-x border-b border-border p-8 md:p-12 shadow-xl"
        >
          <h2 className="text-2xl font-serif font-bold mb-8 border-b border-border pb-4">
            What happens next
          </h2>

          <div className="space-y-8">
            <div className="flex items-start gap-5">
              <div className="mt-1 w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-lg mb-2">Check your inbox now</h3>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Your three Special Reports — <em>Under the Hood: The WBD AI Buildout</em>, <em>The $6.6 Billion Greenlight Window</em>, and <em>Help-Wanted Pages Are Purchase Orders</em> — have been dispatched to your email. You can start applying the system this weekend.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-5">
              <div className="mt-1 w-10 h-10 rounded bg-secondary flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-sans font-bold text-lg mb-2">Tuesday morning</h3>
                <p className="text-muted-foreground text-base leading-relaxed">
                  Your first issue of the HSW Weekly Wire will arrive. It contains the week's live buying signals, filtered and translated. Make sure to whitelist our sending address so it doesn't land in promotions.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border flex justify-center">
            <Link href="/" className="text-sm font-mono-data font-bold text-muted-foreground hover:text-primary transition-colors tracking-widest">
              RETURN TO THE BRIEFING
            </Link>
          </div>
        </motion.div>

      </main>

      <Footer />
    </div>
  );
}
