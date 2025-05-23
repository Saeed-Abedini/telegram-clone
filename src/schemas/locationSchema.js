import mongoose, { Schema } from "mongoose";

const schema = new Schema(
  {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    sender: { type: Schema.ObjectId, ref: "User", required: true },
    roomID: { type: Schema.ObjectId, ref: "Room", required: true },
  },
  { timestamps: true }
);

const LocationSchema =
  mongoose.models.Location || mongoose.model("Location", schema);
export default LocationSchema;
