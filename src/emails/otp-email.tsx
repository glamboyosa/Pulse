import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface OTPEmailProps {
  otpCode?: string
  businessName?: string
}

export const OTPEmail = ({ otpCode, businessName }: OTPEmailProps) => (
  <Html>
    <Head />
    <Preview>Your Pulse login code: {otpCode || ''}</Preview>
    <Body
      style={{
        backgroundColor: '#ffffff',
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
      }}
    >
      <Container
        style={{
          paddingLeft: '12px',
          paddingRight: '12px',
          margin: '0 auto',
          maxWidth: '600px',
        }}
      >
        <Heading
          style={{
            color: '#333',
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '40px 0',
            padding: '0',
          }}
        >
          {businessName ? `Welcome to ${businessName}` : 'Welcome to Pulse'}
        </Heading>
        <Text
          style={{
            color: '#333',
            fontSize: '14px',
            margin: '24px 0',
          }}
        >
          Use this code to complete your login:
        </Text>
        <div
          style={{
            display: 'inline-block',
            padding: '16px 24px',
            width: '100%',
            backgroundColor: '#f4f4f4',
            borderRadius: '8px',
            border: '4px solid #000',
            textAlign: 'center',
            margin: '24px 0',
          }}
        >
          <Text
            style={{
              color: '#000',
              fontSize: '32px',
              fontWeight: 'bold',
              letterSpacing: '8px',
              margin: '0',
              fontFamily: 'monospace',
            }}
          >
            {otpCode}
          </Text>
        </div>
        <Text
          style={{
            color: '#666',
            fontSize: '14px',
            margin: '24px 0',
          }}
        >
          This code will expire in 10 minutes. If you didn&apos;t request this
          code, you can safely ignore this email.
        </Text>
        <Text
          style={{
            color: '#898989',
            fontSize: '12px',
            lineHeight: '22px',
            marginTop: '24px',
            marginBottom: '24px',
          }}
        >
          Pulse - Voice feedback collection made simple.
        </Text>
      </Container>
    </Body>
  </Html>
)

OTPEmail.PreviewProps = {
  otpCode: '123456',
  businessName: 'Pulse',
} as OTPEmailProps

export default OTPEmail
