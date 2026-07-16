// NoSQL / MQL — MongoDB Query Language helpers for the CommunityConfig model.
// Used when running on the Mongo backend (MONGO_URI set). Pure MQL: find,
// updateOne, and an aggregation pipeline.
import CommunityConfig from '../models/CommunityConfig.js';

// Find every community still awaiting approval.
export const findPending = () => CommunityConfig.find({ isApproved: false }).sort({ createdAt: -1 }).lean();

// Look up a community by its public id/subdomain.
export const findByCustomId = (customId) => CommunityConfig.findOne({ customSubdomainOrId: customId }).lean();

// Approve/deny (MQL update).
export const setApproved = (guildId, approved) =>
  CommunityConfig.updateOne({ guildId }, { $set: { isApproved: approved } });

// Upsert a profile change (MQL upsert).
export const upsertProfile = (guildId, patch) =>
  CommunityConfig.updateOne({ guildId }, { $set: patch }, { upsert: true });

// Aggregation pipeline: count communities grouped by approval + verification.
export const statsByState = () =>
  CommunityConfig.aggregate([
    { $group: { _id: { approved: '$isApproved', verify: '$verificationRequired' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
  ]);
