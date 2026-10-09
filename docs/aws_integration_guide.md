# AWS Deployment & Architecture Integration Guide

This guide details the integration boundaries and adapter specifications for deploying **Neighbourlink** onto Amazon Web Services (AWS).

---

## 1. Cloud Architecture Overview

```
                      +-----------------------------+
                      |     AWS Amplify Hosting     |
                      |  (Next.js App Router SSR)   |
                      +--------------+--------------+
                                     |
               +---------------------+---------------------+
               |                     |                     |
               v                     v                     v
       +---------------+     +---------------+     +---------------+
       | Amazon Cognito|     |  API Gateway  |     |   Amazon S3   |
       |  (User Pool   |     |   + Lambda    |     |   (Private    |
       | & MFA Auth)   |     |  (Serverless) |     | Evidence)     |
       +---------------+     +-------+-------+     +---------------+
                                     |
             +-----------------------+-----------------------+
             |                       |                       |
             v                       v                       v
     +---------------+       +---------------+       +---------------+
     |Amazon DynamoDB|       | EventBridge   |       | Amazon SQS    |
     | (Application  |       | (Ingestion    |       | + SNS (Alert  |
     | Data Store)   |       |  Schedules)   |       | Dispatch)     |
     +---------------+       +---------------+       +---------------+
```

---

## 2. Service Adapters & Interfaces

The Neighbourlink codebase uses clean service abstractions so local demo implementations can be replaced by AWS services with zero changes to UI or domain logic.

### 2.1 Storage Service (`IStorageService`)
- **Local Implementation:** `src/app/api/evidence/upload/route.ts` saves to local directory with MIME and size checking.
- **AWS Target:** Private Amazon S3 Bucket (`neighbourlink-evidence-private`) with presigned S3 upload URLs.
- **Adapter Code Blueprint:**
```typescript
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class S3StorageAdapter implements IStorageService {
  private client = new S3Client({ region: process.env.AWS_REGION });
  private bucket = process.env.AWS_S3_EVIDENCE_BUCKET!;

  async generateUploadUrl(key: string, contentType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    });
    return getSignedUrl(this.client, command, { expiresIn: 900 });
  }

  async getPrivateEvidenceUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn: 3600 });
  }
}
```

### 2.2 Authentication Service (`IAuthService`)
- **Local Implementation:** `DemoContext` provides deterministic role-switching (Resident, Responder, Admin) with instant session state.
- **AWS Target:** Amazon Cognito User Pool with JWT token verification and group-based roles (`Residents`, `Responders`, `Admins`).
- **Adapter Code Blueprint:**
```typescript
import { CognitoJwtVerifier } from "aws-jwt-verify";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.AWS_COGNITO_USER_POOL_ID!,
  tokenUse: "access",
  clientId: process.env.AWS_COGNITO_CLIENT_ID!,
});

export async function verifyAwsAuthHeader(authHeader?: string) {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  try {
    const payload = await verifier.verify(token);
    const groups = (payload["cognito:groups"] as string[]) || [];
    const role = groups.includes("Admins")
      ? "ADMIN"
      : groups.includes("Responders")
      ? "RESPONDER"
      : "RESIDENT";
    return { userId: payload.sub, role, email: payload.username };
  } catch {
    return null;
  }
}
```

### 2.3 Notifications Service (`INotificationDispatcher`)
- **Local Implementation:** SQLite `Notification` table polled or dispatched via Server-Sent Events (SSE).
- **AWS Target:** Amazon SQS worker queue decoupled from Amazon SNS topics for high-volume SMS and email alerts.
- **Adapter Code Blueprint:**
```typescript
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

export class AwsNotificationAdapter {
  private sqs = new SQSClient({ region: process.env.AWS_REGION });
  private sns = new SNSClient({ region: process.env.AWS_REGION });

  async queueDispatch(notification: { userId: string; title: string; body: string; phone?: string }) {
    // 1. Queue internal in-app notification job
    await this.sqs.send(
      new SendMessageCommand({
        QueueUrl: process.env.AWS_SQS_NOTIFICATION_QUEUE_URL!,
        MessageBody: JSON.stringify(notification),
      })
    );

    // 2. High-urgency SMS via SNS if phone supplied
    if (notification.phone && process.env.AWS_SNS_ALERT_TOPIC_ARN) {
      await this.sns.send(
        new PublishCommand({
          TopicArn: process.env.AWS_SNS_ALERT_TOPIC_ARN,
          PhoneNumber: notification.phone,
          Message: `[Neighbourlink Alert] ${notification.title}: ${notification.body}`,
        })
      );
    }
  }
}
```

### 2.4 Scheduled Data Ingestion
- **Local Implementation:** Seed script and on-demand API endpoints.
- **AWS Target:** Amazon EventBridge scheduled rule (e.g. `rate(1 hour)`) triggering a Lambda function to fetch meteorological data from regional meteorological endpoints (IMD) into DynamoDB or Aurora.

---

## 3. Environment Variables Configuration

Copy `.env.example` and set the following parameters for AWS deployment:

| Variable | Description |
|---|---|
| `DATABASE_URL` | AWS Aurora PostgreSQL or local SQLite |
| `AWS_REGION` | e.g. `ap-south-1` (Mumbai) |
| `AWS_COGNITO_USER_POOL_ID` | Cognito User Pool ID |
| `AWS_COGNITO_CLIENT_ID` | Cognito App Client ID |
| `AWS_S3_EVIDENCE_BUCKET` | Private S3 Bucket for photos |
| `AWS_SQS_NOTIFICATION_QUEUE_URL` | Notification queue endpoint |
| `AWS_SNS_ALERT_TOPIC_ARN` | Urgent broadcast SNS Topic ARN |
| `NEXT_PUBLIC_DEMO_MODE` | Set to `"false"` in production to disable role switcher |

---

## 4. Security & Privacy Guarantees

1. **Zero Secret Exposure:** AWS Access Keys are NEVER bundled in client-side code; all AWS SDK calls run in server-side Next.js route handlers.
2. **Private Storage:** The S3 evidence bucket is private; files are accessed exclusively through time-limited presigned URLs.
3. **Coordinate Redaction:** Public civilian APIs serve fuzzed coordinates (`fuzzyLatitude`, `fuzzyLongitude` rounded to ~0.01°), while exact GPS coordinates and caller phone numbers remain strictly role-gated on the server.
