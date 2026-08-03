import { Link } from "wouter";
import { Header, Footer } from "@/components/layout/Shell";
import { FOUNDING_RATE_WK, FOUNDING_RATE_YR, REGULAR_RATE_WK, REGULAR_RATE_YR } from "@/lib/constants";
import { motion } from "framer-motion";
import { ArrowRight, FileText, TrendingUp, ShieldCheck } from "lucide-react";
import PreviewSignup from "@/components/PreviewSignup";

const FadeIn = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.7, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
  >
    {children}
  </motion.div>
);

export default function SalesPage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-foreground selection:bg-primary/20">
      <Header />
      
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        
        {/* Ticker / Dateline */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="flex items-center gap-4 mb-16 border-b border-border pb-4"
        >
          <div className="flex flex-col">
            <span className="font-mono-data text-muted-foreground">FROM THE DESK OF</span>
            <span className="font-serif text-sm font-semibold tracking-wider">KARILYN COLEGROVE</span>
          </div>
          <div className="w-px h-8 bg-border"></div>
          <div className="flex flex-col">
            <span className="font-mono-data text-muted-foreground">SUBJECT</span>
            <span className="font-serif text-sm font-semibold tracking-wider text-accent">THE GREENLIGHT WINDOW</span>
          </div>
        </motion.div>

        {/* Hero Headline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mb-16"
        >
          <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-serif font-bold leading-[1.05] tracking-tight mb-6 text-balance text-foreground">
            The lead list your competitors bought is already dead.
          </h1>
          <p className="text-xl sm:text-2xl text-muted-foreground font-serif italic leading-relaxed text-balance">
            170 funded productions, $6.6 billion, all on a public list. Somebody's going to call them first.
          </p>
        </motion.div>

        {/* The Copy */}
        <article className="prose prose-lg md:prose-xl prose-zinc max-w-none prose-p:leading-[1.8] prose-headings:font-serif prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary/80 prose-strong:font-bold prose-strong:text-foreground">
          
          <FadeIn>
            <p className="first-letter:text-7xl first-letter:font-serif first-letter:font-bold first-letter:mr-4 first-letter:float-left first-letter:text-primary first-letter:leading-[0.8] first-line:uppercase first-line:tracking-widest first-line:text-sm first-line:font-bold first-line:font-sans">
              Three weeks ago, California's film office closed the books on the first year of its expanded tax credit: 170 productions awarded, $6.6 billion in direct production spending — including 41 new films greenlit in the final round alone.
            </p>
            <p>
              Not projections. Not "industry outlook." Awards. Named productions, approved budgets, published on a state list — which means every one of them is now on a clock: crew up, book stages, cut purchase orders, spend the money or lose the credit.
            </p>
            <p>
              California alone now moves three-quarters of a billion dollars a year through its expanded credit. Georgia doesn't even cap its program. And every production on those award lists is a company that is about to buy things: cameras, stages, software, localization, post, payroll, insurance — the whole supply chain of a budget with a deadline.
            </p>
          </FadeIn>

          <FadeIn>
            <h2 className="text-3xl mt-16 mb-6">Here's the part that should bother you.</h2>
            <p>
              The "industry lead lists" your competitors are working from — the $15,000-a-year databases, the festival directories, the scraped LinkedIn exports — were cold before they were ever sold. Six months stale on a good day.
            </p>
            <p>
              And it's worse than stale: the list companies rent those same names out, over and over, to anyone with a marketing budget. By the time you dial, that contact has been pitched by a dozen vendors, three conferences, and a webinar series. They're not just cold. They're sick of the phone.
            </p>
            <div className="pl-6 py-2 my-10 border-l-4 border-primary bg-secondary/20 -mx-6 px-6 sm:mx-0">
              <p className="text-xl font-serif italic text-foreground/90 m-0 leading-relaxed">
                Picture two salespeople selling the same product into the same studios. The first works a purchased list. The second works a state tax-credit award list published within the last two weeks. Same skill. Same product. The second rep isn't better. Her leads are simply <em>alive</em>.
              </p>
            </div>
            <p>
              Meanwhile the hot list — who got money <em>this month</em> and has to spend it — sits in public filings that almost nobody in sales reads, because reading them is a genuinely tedious skill.
            </p>
          </FadeIn>

          <FadeIn>
            <h2 className="text-3xl mt-16 mb-6">The Hollywood Sales Wire Solution</h2>
            <p>
              That's the entire idea behind <strong>Hollywood Sales Wire</strong>: I read the filings, the award lists, the requisitions, and the money flows every week, and every Tuesday you get the names — who just got funded, what they're about to buy, and when the window closes.
            </p>
            <p>
              <strong>Cold leads are a commodity. Hot leads are an edge.</strong>
            </p>
            <p>
              And let me be straight about what it is and isn't. Every subscriber gets the same Tuesday wire. But here's what will never happen: I will never rent this list. Not the leads, and not <em>you</em>. Your prospects aren't being hammered by everyone who paid a list broker, and your inbox isn't being sold to one either. In this business, that alone puts you in rare company.
            </p>
          </FadeIn>

          <FadeIn>
            <PreviewSignup />
          </FadeIn>

          {/* Method Story */}
          <FadeIn>
            <div className="bg-secondary/30 border border-border p-8 my-16 relative">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <FileText className="w-32 h-32" />
              </div>
              <h3 className="text-2xl mt-0 mb-6 flex items-center gap-3 font-serif">
                <TrendingUp className="w-6 h-6 text-primary" />
                The Method in Practice
              </h3>
              <p className="text-base sm:text-lg mb-4">
                When a streamer signs a major live-sports rights deal — the way Netflix pushed into live NFL games, or Amazon's NBA package — the press covers the rights fee and stops there. But between "we own the rights" and "we're on the air" sits a massive buildout.
              </p>
              <p className="text-base sm:text-lg mb-0">
                You can't see the purchase orders. But you can see the <em>hiring</em>. The requisitions appear on careers pages: <em>Broadcast Systems Engineer</em>, <em>Technical Program Manager, Live Events</em>. To a salesperson who knows how to read them, those postings say: the budget is real, the buildout has started, and vendor decisions are being made <em>right now</em>. The purchase orders will follow within the quarter. The signal was public the whole time.
              </p>
            </div>
          </FadeIn>

          {/* The Stack */}
          <FadeIn>
            <h2 className="text-3xl mt-16 mb-8">Everything a Member Gets</h2>
            <p className="mb-10">
              Hollywood Sales Wire is a weekly intelligence briefing. Every Tuesday, you get the week's live buying signals. The system behind it is documented in three Special Reports — <strong>free and immediately</strong> with your membership. Founding Memberships, at half the regular rate, are offered exclusively through our email list.
            </p>

            <div className="space-y-6 not-prose mb-12">
              {[
                {
                  title: "Under the Hood: The WBD AI Buildout",
                  value: "$795 value",
                  desc: "How Warner Bros. Discovery is actually building its AI capability, 8,700 miles from Burbank — who is hired, where, at what cost, and for what work, drawn from job postings, government records, corporate filings, and salary data on two continents. Not a scandal; a map."
                },
                {
                  title: "The $6.6 Billion Greenlight Window",
                  value: "$695 value",
                  desc: "The state tax-credit system decoded. Which states publish lists, on what calendar, and the narrow window between greenlight and spend when a production buys everything."
                },
                {
                  title: "Help-Wanted Pages Are Purchase Orders",
                  value: "$495 value",
                  desc: "Careers pages as disclosure documents. The job-title tells, the posting patterns that reveal a buildout weeks before any purchase order, and a full named walkthrough of a nine-figure streaming-sports buildout."
                }
              ].map((report, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-5 p-6 border-l-2 border-primary bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="sm:w-1/3 shrink-0">
                    <h4 className="font-serif font-bold text-lg text-foreground">{report.title}</h4>
                    <span className="inline-block mt-2 px-2 py-1 bg-secondary text-secondary-foreground text-xs font-mono-data rounded-sm font-bold">
                      {report.value}
                    </span>
                  </div>
                  <div className="sm:w-2/3">
                    <p className="text-muted-foreground leading-relaxed text-sm m-0">
                      {report.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </FadeIn>

          <FadeIn>
            <p>
              That's <strong>$1,985 in Special Reports</strong> — a crash course in producing your own hot leads that the $15,000-a-year databases don't teach. Free with your membership, and yours to keep forever.
            </p>
            <p>
              Plus, once a month, subscribers receive <strong>The Divergence Report</strong> — the strategic layer on top of the weekly wire. It's the deeper monthly read on where the money is moving <em>next quarter</em>, so you're positioned before the crowd shows up. The wire is your calls for the week; the Divergence Report is your plan for the season. Both come with the subscription.
            </p>
          </FadeIn>

          <FadeIn>
            <h2 className="text-3xl mt-16 mb-6">The Math & The Guarantee</h2>
            <p>
              The regular rate for Hollywood Sales Wire is ${REGULAR_RATE_WK} a week (${REGULAR_RATE_YR.toLocaleString()} a year). One closed deal sourced from one issue pays for years of it.
            </p>
            <div className="bg-primary text-primary-foreground p-8 my-10 shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.05\'/%3E%3C/svg%3E')] opacity-50 mix-blend-overlay"></div>
              <p className="font-serif text-xl sm:text-2xl leading-relaxed m-0 relative z-10 text-balance">
                On our email list, invited readers get the Founding Member rate instead: <strong>${FOUNDING_RATE_WK} a week — ${FOUNDING_RATE_YR.toLocaleString()} a year — locked in for as long as you stay a member.</strong> Join the list below and your invitation follows.
              </p>
            </div>
            <p>
              Notice the math: the Special Reports alone ($1,985) are worth the Founding Membership fee ($1,995). The fifty-two weekly issues and twelve Divergence Reports are, in effect, thrown in.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-6 p-8 border border-border mt-10 bg-card">
              <ShieldCheck className="w-10 h-10 text-primary shrink-0 sm:mt-1" />
              <div>
                <h4 className="font-serif font-bold text-2xl mb-3 m-0">The 90-Day Money-Back Guarantee</h4>
                <p className="text-base m-0 text-muted-foreground leading-relaxed">
                  Take 90 days — roughly thirteen issues of the Wire and three Divergence Reports. If it hasn't put live, workable prospects in front of you, write me and I'll refund every penny. Everything you've received — all three Special Reports and every issue delivered — is yours to keep either way. I've kept all the risk on my side of the table.
                </p>
              </div>
            </div>
          </FadeIn>

          <FadeIn>
            <h2 className="text-3xl mt-16 mb-6">How the Founding Offer Works</h2>
            <p>
              The Founding Member rate isn't on this website's order page — it comes by invitation through our email list, and every invitation has a real deadline: your personal offer closes at midnight Eastern, and the clock is enforced. After your deadline, membership is ${REGULAR_RATE_WK} a week like everyone else.
            </p>
            <p>
              Subscribe before your deadline and everything is immediate: the three Special Reports in your inbox tonight, your first issue of the Wire this Tuesday.
            </p>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="mt-16 mb-16 not-prose flex flex-col items-center">
              <Link href="/order" className="group relative inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground px-8 sm:px-12 py-5 sm:py-6 text-xl font-serif font-bold hover:bg-primary/90 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 w-full sm:w-auto text-center overflow-hidden">
                <span className="absolute inset-0 w-full h-full -mt-1 rounded-lg opacity-30 bg-gradient-to-b from-transparent via-transparent to-black"></span>
                <span className="relative flex items-center gap-3">
                  Become a Member <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              <div className="mt-6 flex flex-col items-center text-center">
                <span className="text-sm font-mono-data text-muted-foreground font-bold tracking-widest uppercase">
                  ${REGULAR_RATE_WK} / WEEK
                </span>
                <span className="text-xs text-muted-foreground mt-1">
                  Billed annually. Rate lock guaranteed.
                </span>
              </div>
            </div>
          </FadeIn>
          
          <FadeIn>
            <div className="border-t border-border pt-8 mt-12 pb-4">
              <p className="text-lg font-serif italic mb-8">
                Whatever you decide, thank you for reading this far. If the Wire isn't for you, I hope this at least changed how you look at a careers page.
              </p>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-secondary rounded-full flex items-center justify-center font-serif text-xl font-bold text-muted-foreground">
                  K
                </div>
                <div>
                  <div className="font-serif font-bold text-lg leading-tight">Karilyn Colegrove</div>
                  <div className="text-sm text-muted-foreground font-mono-data">PUBLISHER, HOLLYWOOD SALES WIRE</div>
                </div>
              </div>
            </div>

            <div className="mt-12 text-sm text-muted-foreground italic border-l-2 border-border pl-4">
              <strong>P.S.</strong> One question worth sitting with: when a state publishes a list of 170 funded productions worth $6.6 billion, who in your company is assigned to call those productions first? If the answer is "nobody," that's fixable — by Tuesday.
            </div>
          </FadeIn>

          <FadeIn>
            <PreviewSignup />
          </FadeIn>

        </article>
      </main>

      <Footer />
    </div>
  );
}
