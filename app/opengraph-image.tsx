import { ImageResponse } from 'next/og'

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          backgroundColor: '#f8f4ee',
          color: '#111111',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '32px',
            fontWeight: 800,
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: '#f97316',
              border: '4px solid #111111',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 900,
            }}
          >
            P
          </div>
          Pulse
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 900,
              lineHeight: 1.05,
              whiteSpace: 'pre-line',
            }}
          >
            {"Hear your customers,\n don't just read them."}
          </div>
          <div style={{ fontSize: '28px', fontWeight: 600, maxWidth: '900px' }}>
            QR-based voice feedback with instant transcription and saved audio.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '20px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: '18px',
              fontSize: '22px',
              fontWeight: 700,
            }}
          >
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '999px',
                border: '3px solid #111111',
                backgroundColor: '#fff7ed',
              }}
            >
              QR scans
            </div>
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '999px',
                border: '3px solid #111111',
                backgroundColor: '#fff7ed',
              }}
            >
              Live transcript
            </div>
            <div
              style={{
                padding: '12px 18px',
                borderRadius: '999px',
                border: '3px solid #111111',
                backgroundColor: '#fff7ed',
              }}
            >
              Saved audio
            </div>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800 }}>
            Limited time: 3 free pulses
          </div>
        </div>
      </div>
    ),
    size,
  )
}
