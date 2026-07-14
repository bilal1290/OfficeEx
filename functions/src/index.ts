import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

admin.initializeApp();

const smtpHost = defineString('SMTP_HOST', { default: 'smtp.gmail.com' });
const smtpPort = defineString('SMTP_PORT', { default: '465' });
const smtpUser = defineString('SMTP_USER', { default: '' });
const smtpPass = defineString('SMTP_PASS', { default: '' });
const smtpFrom = defineString('SMTP_FROM', { default: '' });

interface SendPayslipEmailRequest {
  to: string;
  employeeName: string;
  periodLabel: string;
  pdfBase64: string;
  fileName: string;
}

async function assertPayrollSender(uid: string | undefined) {
  if (!uid) {
    throw new HttpsError('unauthenticated', 'You must be signed in to send payslip emails.');
  }

  const snapshot = await admin.database().ref(`users/${uid}`).get();
  const role = snapshot.val()?.role as string | undefined;
  if (role !== 'admin' && role !== 'viewer') {
    throw new HttpsError('permission-denied', 'Only payroll managers can email payslips.');
  }
}

function getTransporter() {
  const user = smtpUser.value();
  const pass = smtpPass.value();

  if (!user || !pass) {
    throw new HttpsError(
      'failed-precondition',
      'Email is not configured. Set SMTP_USER and SMTP_PASS for Cloud Functions.',
    );
  }

  return nodemailer.createTransport({
    host: smtpHost.value(),
    port: Number(smtpPort.value()),
    secure: Number(smtpPort.value()) === 465,
    auth: { user, pass },
  });
}

export const notifyAdminNewRegistration = onCall(async (request) => {
  const data = request.data as {
    displayName?: string;
    email?: string;
    registrationKind?: 'team' | 'employee';
  };

  const displayName = data?.displayName?.trim();
  const email = data?.email?.trim();
  const registrationKind = data?.registrationKind === 'employee' ? 'employee' : 'team';

  if (!displayName || !email) {
    throw new HttpsError('invalid-argument', 'Missing registration details.');
  }

  const usersSnapshot = await admin.database().ref('users').get();
  const adminEmails: string[] = [];

  usersSnapshot.forEach((child) => {
    const user = child.val() as { role?: string; email?: string; accountStatus?: string };
    if (user.role === 'admin' && user.email?.trim()) {
      if (!user.accountStatus || user.accountStatus === 'verified') {
        adminEmails.push(user.email.trim());
      }
    }
  });

  if (adminEmails.length === 0) {
    return { success: true, notified: 0 };
  }

  const smtpConfigured = Boolean(smtpUser.value() && smtpPass.value());
  if (!smtpConfigured) {
    return { success: true, notified: 0 };
  }

  const from = smtpFrom.value() || smtpUser.value();
  const transporter = getTransporter();
  const kindLabel = registrationKind === 'employee' ? 'Employee' : 'Team member';
  const appUrl = process.env.APP_URL || 'https://officeex.app';

  try {
    await transporter.sendMail({
      from: `OfficeEx <${from}>`,
      to: adminEmails.join(','),
      subject: `New ${kindLabel.toLowerCase()} registration · ${displayName}`,
      text: [
        'A new external registration is waiting for approval.',
        '',
        `Name: ${displayName}`,
        `Email: ${email}`,
        `Type: ${kindLabel}`,
        '',
        `Review pending accounts on the Team page: ${appUrl}/users`,
      ].join('\n'),
      html: `
        <p>A new external registration is waiting for approval.</p>
        <ul>
          <li><strong>Name:</strong> ${displayName}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Type:</strong> ${kindLabel}</li>
        </ul>
        <p><a href="${appUrl}/users">Review pending accounts on the Team page</a></p>
      `,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error';
    throw new HttpsError('internal', `Failed to notify administrators: ${message}`);
  }

  return { success: true, notified: adminEmails.length };
});

export const sendPayslipEmail = onCall(async (request) => {
  await assertPayrollSender(request.auth?.uid);

  const data = request.data as SendPayslipEmailRequest;
  const to = data?.to?.trim();
  const employeeName = data?.employeeName?.trim();
  const periodLabel = data?.periodLabel?.trim();
  const pdfBase64 = data?.pdfBase64?.trim();
  const fileName = data?.fileName?.trim() || 'payslip.pdf';

  if (!to || !employeeName || !periodLabel || !pdfBase64) {
    throw new HttpsError('invalid-argument', 'Missing payslip email payload.');
  }

  const from = smtpFrom.value() || smtpUser.value();
  const transporter = getTransporter();

  try {
    await transporter.sendMail({
      from: `OfficeEx <${from}>`,
      to,
      subject: `Salary invoice · ${periodLabel}`,
      text: [
        `Hello ${employeeName},`,
        '',
        `Your salary invoice for ${periodLabel} is attached.`,
        '',
        'This message was sent from OfficeEx.',
      ].join('\n'),
      html: `
        <p>Hello <strong>${employeeName}</strong>,</p>
        <p>Your salary invoice for <strong>${periodLabel}</strong> is attached.</p>
        <p style="color:#666;font-size:13px;">This message was sent from OfficeEx.</p>
      `,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email error';
    throw new HttpsError('internal', `Failed to send payslip email: ${message}`);
  }

  return { success: true };
});
