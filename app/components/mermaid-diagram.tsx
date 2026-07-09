"use client"

import { useEffect, useRef, useState } from "react"

interface MermaidDiagramProps {
  chart: string
  id: string
}

export function MermaidDiagram({ chart, id }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const renderDiagram = async () => {
      try {
        const mermaid = (await import("mermaid")).default

        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          sequence: {
            diagramMarginX: 50,
            diagramMarginY: 10,
            actorMargin: 50,
            width: 150,
            height: 65,
            boxMargin: 10,
            boxTextMargin: 5,
            noteMargin: 10,
            messageMargin: 35,
            mirrorActors: true,
          },
        })

        if (containerRef.current && mounted) {
          const { svg } = await mermaid.render(`mermaid-${id}`, chart)
          if (containerRef.current && mounted) {
            containerRef.current.innerHTML = svg
          }
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to render diagram")
        }
      }
    }

    renderDiagram()

    return () => {
      mounted = false
    }
  }, [chart, id])

  if (error) {
    return (
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
        <p className="font-medium">Error rendering diagram:</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="overflow-x-auto" />
}
