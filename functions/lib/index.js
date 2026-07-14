"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPayslipEmail = exports.notifyAdminNewRegistration = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const nodemailer_1 = __importDefault(require("nodemailer"));
admin.initializeApp();
const smtpHost = (0, params_1.defineString)('SMTP_HOST', { default: 'smtp.gmail.com' });
const smtpPort = (0, params_1.defineString)('SMTP_PORT', { default: '465' });
const smtpUser = (0, params_1.defineString)('SMTP_USER', { default: '' });
const smtpPass = (0, params_1.defineString)('SMTP_PASS', { default: '' });
const smtpFrom = (0, params_1.defineString)('SMTP_FROM', { default: '' });
async function assertPayrollSender(uid) {
    var _a;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to send payslip emails.');
    }
    const snapshot = await admin.database().ref(`users/${uid}`).get();
    const role = (_a = snapshot.val()) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== 'admin' && role !== 'viewer') {
        throw new https_1.HttpsError('permission-denied', 'Only payroll managers can email payslips.');
    }
}
function getTransporter() {
    const user = smtpUser.value();
    const pass = smtpPass.value();
    if (!user || !pass) {
        throw new https_1.HttpsError('failed-precondition', 'Email is not configured. Set SMTP_USER and SMTP_PASS for Cloud Functions.');
    }
    return nodemailer_1.default.createTransport({
        host: smtpHost.value(),
        port: Number(smtpPort.value()),
        secure: Number(smtpPort.value()) === 465,
        auth: { user, pass },
    });
}
exports.notifyAdminNewRegistration = (0, https_1.onCall)(async (request) => {
    var _a, _b;
    const data = request.data;
    const displayName = (_a = data === null || data === void 0 ? void 0 : data.displayName) === null || _a === void 0 ? void 0 : _a.trim();
    const email = (_b = data === null || data === void 0 ? void 0 : data.email) === null || _b === void 0 ? void 0 : _b.trim();
    const registrationKind = (data === null || data === void 0 ? void 0 : data.registrationKind) === 'employee' ? 'employee' : 'team';
    if (!displayName || !email) {
        throw new https_1.HttpsError('invalid-argument', 'Missing registration details.');
    }
    const usersSnapshot = await admin.database().ref('users').get();
    const adminEmails = [];
    usersSnapshot.forEach((child) => {
        var _a;
        const user = child.val();
        if (user.role === 'admin' && ((_a = user.email) === null || _a === void 0 ? void 0 : _a.trim())) {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown email error';
        throw new https_1.HttpsError('internal', `Failed to notify administrators: ${message}`);
    }
    return { success: true, notified: adminEmails.length };
});
exports.sendPayslipEmail = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c, _d, _e, _f;
    await assertPayrollSender((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid);
    const data = request.data;
    const to = (_b = data === null || data === void 0 ? void 0 : data.to) === null || _b === void 0 ? void 0 : _b.trim();
    const employeeName = (_c = data === null || data === void 0 ? void 0 : data.employeeName) === null || _c === void 0 ? void 0 : _c.trim();
    const periodLabel = (_d = data === null || data === void 0 ? void 0 : data.periodLabel) === null || _d === void 0 ? void 0 : _d.trim();
    const pdfBase64 = (_e = data === null || data === void 0 ? void 0 : data.pdfBase64) === null || _e === void 0 ? void 0 : _e.trim();
    const fileName = ((_f = data === null || data === void 0 ? void 0 : data.fileName) === null || _f === void 0 ? void 0 : _f.trim()) || 'payslip.pdf';
    if (!to || !employeeName || !periodLabel || !pdfBase64) {
        throw new https_1.HttpsError('invalid-argument', 'Missing payslip email payload.');
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown email error';
        throw new https_1.HttpsError('internal', `Failed to send payslip email: ${message}`);
    }
    return { success: true };
});
//# sourceMappingURL=index.js.map