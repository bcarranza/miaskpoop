"use client"

import { useEffect, useRef } from "react"

type YTPlayerInstance = {
  unMute(): void
  setVolume(v: number): void
  destroy(): void
}

type YTPlayerCtor = {
  new (
    el: HTMLElement | string,
    opts: {
      videoId: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: YTPlayerInstance }) => void
      }
    },
  ): YTPlayerInstance
}

declare global {
  interface Window {
    YT: { Player: YTPlayerCtor }
    onYouTubeIframeAPIReady?: () => void
  }
}

let scriptAppended = false
let apiReady = false
const pendingCallbacks: Array<() => void> = []

function whenApiReady(cb: () => void) {
  if (apiReady) { cb(); return }
  pendingCallbacks.push(cb)
  if (!scriptAppended) {
    scriptAppended = true
    window.onYouTubeIframeAPIReady = () => {
      apiReady = true
      pendingCallbacks.splice(0).forEach((fn) => fn())
    }
    const tag = document.createElement("script")
    tag.src = "https://www.youtube.com/iframe_api"
    document.head.appendChild(tag)
  }
}

function extractVideoId(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : url
}

const INTERACTION_EVENTS = ["click", "touchstart", "keydown", "scroll"] as const

export function MusicPlayer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayerInstance | null>(null)
  const unmutedRef = useRef(false)
  const videoId = extractVideoId(url)

  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current

    function unmute() {
      if (unmutedRef.current) return
      unmutedRef.current = true
      playerRef.current?.unMute()
      playerRef.current?.setVolume(70)
      INTERACTION_EVENTS.forEach((ev) => document.removeEventListener(ev, unmute))
    }

    whenApiReady(() => {
      playerRef.current = new window.YT.Player(el, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (e) => {
            // Try immediately — works if the browser already has a user gesture
            try {
              e.target.unMute()
              e.target.setVolume(70)
              unmutedRef.current = true
            } catch {
              // Blocked — will unmute on first interaction instead
            }
          },
        },
      })
    })

    // Fallback: unmute on the first user interaction with the page
    INTERACTION_EVENTS.forEach((ev) =>
      document.addEventListener(ev, unmute, { once: true, passive: true }),
    )

    return () => {
      INTERACTION_EVENTS.forEach((ev) => document.removeEventListener(ev, unmute))
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [videoId])

  return <div ref={containerRef} className="absolute size-0 overflow-hidden opacity-0" />
}
