import Image from 'next/image'

/** Branded logo + wordmark for the docs navigation bar. */
export function DocsNavTitle() {
  return (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/images/dorkian-logo.svg"
        alt="Loop"
        width={20}
        height={20}
        className="block dark:hidden"
      />
      <Image
        src="/images/dorkian-logo-white.svg"
        alt="Loop"
        width={20}
        height={20}
        className="hidden dark:block"
      />
      <span className="font-mono text-xs tracking-[0.15em] uppercase font-medium">
        Loop
      </span>
    </span>
  )
}
