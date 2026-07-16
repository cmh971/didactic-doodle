// Mongoose schema for CommunityConfig (as specified). This is the canonical model
// for a MongoDB deployment — it becomes active when MONGO_URI is set and mongoose
// is installed. The live app also mirrors these exact fields in the embedded
// SQLite store (src/community/store.js) so it runs with zero external services.
//
// To use Mongo:  npm i mongoose  +  set MONGO_URI  →  connectMongo() in index.js.
import mongoose from 'mongoose';

const WidgetSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // e.g. 'leaderboard', 'text', 'links'
    title: { type: String, default: '' },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const CommunityConfigSchema = new mongoose.Schema(
  {
    guildId: { type: String, required: true, unique: true, index: true },
    customSubdomainOrId: { type: String, required: true, unique: true, index: true },
    communityName: { type: String, default: 'New Community' },
    themeColor: { type: String, default: '#5865f2' },
    homePageMarkdown: { type: String, default: 'Welcome to our community!' },
    verificationRequired: { type: Boolean, default: false },
    isApproved: { type: Boolean, default: false },
    widgets: { type: [WidgetSchema], default: [] },
  },
  { timestamps: true },
);

export const CommunityConfig =
  mongoose.models.CommunityConfig || mongoose.model('CommunityConfig', CommunityConfigSchema);

// Optional connector — call once at startup if you want the Mongo backend.
export async function connectMongo() {
  if (!process.env.MONGO_URI) return false;
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🍃 Connected to MongoDB');
  return true;
}

export default CommunityConfig;
