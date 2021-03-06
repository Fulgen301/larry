// models/File.ts

import { Schema, PaginateModel, Document } from "mongoose";
import { mongoose } from "../config/database";

import * as fs from "fs";
import { Readable } from "stream";

import * as crypto from "crypto";
import { IUser } from "./User";


export interface IFile extends Document {
  author: IUser;
  length: number;
  chunkSize: number;
  uploadDate: Date;
  md5: string;
  filename: string;
  contentType: string;
  aliases: string[];
  metadata: {};
}

export interface IFileModel extends PaginateModel<IFile> {
  uploadFromFs(file: {}, options: {}): Promise<IFile>;
  createReadStream(file: any): Readable;
  hashify(): Promise<IFile>;
}

const FileSchema = new mongoose.Schema({
  length: {
    type: Number
  },
  chunkSize: {
    type: Number
  },
  uploadDate: {
    type: Date
  },
  md5: {
    type: String
  },
  filename: {
    type: String
  },
  contentType: {
    type: String
  },
  aliases: [{
    type: String
  }],
  metadata: {
    type: mongoose.SchemaTypes.Mixed
  },
  author: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
}, {
  collection: "fs.files"
});

FileSchema.methods.hashify = function() {
  return new Promise((resolve, reject) => {
    const readstream = mongoose.gfs.createReadStream({
      _id: this.id,
    });
    const sha1 = crypto.createHash("sha1");
    const sha2 = crypto.createHash("sha2");

    readstream.on("error", reject);
    readstream.on("data", (chunk: Buffer) => {
      sha1.update(chunk);
      sha2.update(chunk);
    });
    readstream.on("end", () => {
      this.model("File").findByIdAndUpdate(this._id, {
        $set: {
          metadata: {
            hashes: {
              sha1: sha1.digest("hex"),
              sha256: sha2.digest("hex"),
              md5: this.md5,
            }
          }
        }
      }, { new: true }, (err: Error, doc: mongoose.Document) => {
        if (err) {
          reject(err);
        }
        resolve(doc);
      });
    });
  });
};

FileSchema.methods.createReadStream = function() {
  return mongoose.gfs.createReadStream({
    _id: this.id,
  });
};

FileSchema.statics.uploadFromFs = function(file: any, { hashes = false }: { hashes: boolean }) {
  return new Promise((resolve, reject) => {
    const gridStream = mongoose.gfs.createWriteStream({
      filename: file.originalname,
      content_type: file.mimetype,
    });

    const sha1 = hashes ? crypto.createHash("sha1") : undefined;
    const sha2 = hashes ? crypto.createHash("sha256") : undefined;

    fs.createReadStream(file.path)
      .on("data", (chunk: Buffer) => {
        if (hashes) {
          sha1.update(chunk);
          sha2.update(chunk);
        }
      })
      .on("error", reject)
      .pipe(gridStream);

    gridStream.on("error", reject);
    gridStream.on("close", (file: IFile) => {
      const metadata: { hashes: { md5?: string, sha1?: string, sha256?: string } } = {
        hashes: {
          md5: file.md5,
        }
      };

      if (hashes) {
        metadata.hashes.sha1 = sha1.digest("hex");
        metadata.hashes.sha256 = sha2.digest("hex");
      }

      this.findByIdAndUpdate(file._id, {
        $set: {
          metadata
        }
      }, { new: true }, (err: Error, file: IFile) => {
        if (err) {
          reject(err);
        }
        resolve(file);
      });
    });
  });
};

export const File = mongoose.model<IFile>("File", FileSchema) as IFileModel;
