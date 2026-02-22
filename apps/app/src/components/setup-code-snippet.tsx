import { useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'

interface SetupCodeSnippetProps {
  apiUrl: string
  apiKey: string
  onCopy?: () => void
}

type Language = 'curl' | 'javascript' | 'python'

function buildSnippet(lang: Language, apiUrl: string, apiKey: string): string {
  switch (lang) {
    case 'curl':
      return `curl -X POST ${apiUrl}/api/issues \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "My first issue",
    "type": "task",
    "status": "todo"
  }'`
    case 'javascript':
      return `const response = await fetch("${apiUrl}/api/issues", {
  method: "POST",
  headers: {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "My first issue",
    type: "task",
    status: "todo",
  }),
});

const data = await response.json();
console.log(data);`
    case 'python':
      return `import requests

response = requests.post(
    "${apiUrl}/api/issues",
    headers={
        "Authorization": "Bearer ${apiKey}",
        "Content-Type": "application/json",
    },
    json={
        "title": "My first issue",
        "type": "task",
        "status": "todo",
    },
)

print(response.json())`
  }
}

/** Tabbed code block showing curl/JS/Python snippets with real API credentials injected. */
export function SetupCodeSnippet({ apiUrl, apiKey, onCopy }: SetupCodeSnippetProps) {
  const [copiedTab, setCopiedTab] = useState<Language | null>(null)
  const [activeTab, setActiveTab] = useState<Language>('curl')

  const handleCopy = useCallback(
    async (lang: Language) => {
      const snippet = buildSnippet(lang, apiUrl, apiKey)
      await navigator.clipboard.writeText(snippet)
      setCopiedTab(lang)
      onCopy?.()
      setTimeout(() => setCopiedTab(null), 2000)
    },
    [apiUrl, apiKey, onCopy],
  )

  return (
    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as Language)}>
      <TabsList className="h-auto bg-transparent p-0">
        <TabsTrigger value="curl" className="text-sm">curl</TabsTrigger>
        <TabsTrigger value="javascript" className="text-sm">JavaScript</TabsTrigger>
        <TabsTrigger value="python" className="text-sm">Python</TabsTrigger>
      </TabsList>
      {(['curl', 'javascript', 'python'] as const).map((lang) => (
        <TabsContent key={lang} value={lang} className="relative mt-2">
          <div className="relative rounded-md bg-muted p-4 font-mono text-sm">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 size-7"
              onClick={() => void handleCopy(lang)}
            >
              {copiedTab === lang ? (
                <Check className="size-3.5 text-green-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </Button>
            <pre className="overflow-x-auto whitespace-pre-wrap pr-10">
              {buildSnippet(lang, apiUrl, apiKey)}
            </pre>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
