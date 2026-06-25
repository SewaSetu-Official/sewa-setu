export type ImpactStat = { n: string; l: string };

export function ImpactBand({ stats }: { stats: ImpactStat[] }) {
  return (
    <section className="bg-brand text-white">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-6 px-5 py-14 sm:px-8 md:grid-cols-4 lg:px-10">
        {stats.map((s) => (
          <div key={s.l}>
            <div className="font-display text-[clamp(2.2rem,4vw,2.875rem)] font-bold leading-none tracking-[-0.03em]">
              {s.n}
            </div>
            <div className="mt-2 text-[15px] font-medium text-[#CFE0D8]">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
