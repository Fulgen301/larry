// routes/uploads/UploadController.ts

import { NextFunction, Request, Response } from "express";
import * as pluralize from "pluralize";
import httpStatus = require("http-status");
import jsonxml = require("jsontoxml");
import { Controller, PaginationParams, ObjectIdParam } from "../Controller";
import { Upload, IUpload } from "../../models/Upload";
import { IUser, User } from "../../models/User";
import { CommentController } from "../comments/CommentController";
import { VotingController } from "../voting/VotingController";
import auth = require("../../config/auth");
import _ = require("lodash");

export class UploadController extends Controller {
  protected _comments: CommentController;
  protected _voting: VotingController;

  public constructor() {
    super();
    this._comments = new CommentController();
    this._voting = new VotingController((req: Request) => req.upload);

    this.router.param("upload", this.uploadParam);

    // auth
    this.router.use(this.checkAuthentication);

    this.router.get("/", auth.optional, this.checkPermissions(this.getRecord), this.index);

    // Forms
    this.router.get("/create", auth.required, this.checkPermissions(this.getRecord), this.create);

    // Subresources
    this.router.use("/:upload/comments", this._comments.router);
    this.router.use("/:upload/vote", this._voting.router);

    // CRUD
    this.router.post("/", auth.required, this.checkPermissions(this.getRecord), this.post);
    this.router.get("/:upload", this.checkPermissions(this.getRecord), this.get);
    this.router.put("/:upload", auth.required, this.checkPermissions(this.getRecord), this.put);
    this.router.delete("/:upload", auth.required, this.checkPermissions(this.getRecord), this.delete);
  }

  protected getRecord(req: Request, ...args: any[]): IUpload {
    return req.upload;
  }

  @ObjectIdParam
  private async uploadParam(req: Request, res: Response, next: NextFunction, id: string) {
    try {
      req.upload = await Upload
        .findById(id)
        .populate("author", "username")
        .populate("pic")
        .populate("files")
        .populate("dependencies");
      if (req.upload) {
        next();
      } else {
        const error = new Error();
        error.status = httpStatus.NOT_FOUND;
        next(error);
      }
    } catch (e) {
      next(e);
    }
  }

  @PaginationParams
  public async index(req: Request, res: Response, next: NextFunction) {
    const {query: {limit, page, sort = {createdAt: -1}, query = {}}} = req;
    const {docs: uploads, ...pagination} = await Upload.paginate(query,
      {
        sort,
        page,
        limit
      }
    );
    const response = {
      pagination,
      uploads
    };
    res.format({
      html: function () {
        res.render("upload/index", response);
      },
      json: function () {
        res.json(response);
      },
      "application/xml": function () {
        res.send(jsonxml(JSON.stringify({resource: response})));
      }
    });
    next();
  }


  public async post(req: Request, res: Response, next: NextFunction) {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.sendStatus(httpStatus.UNAUTHORIZED);
    }
    req.body.author = user;

    const upload = await Upload.create(req.body);
    res.json(upload);
  }

  public async get(req: Request, res: Response, next: NextFunction) {
    res.format({
      html: function () {
        res.render("upload/get", req.upload);
      },
      json: function () {
        res.json(req.upload);
      },
      "application/xml": function () {
        res.send(jsonxml(JSON.stringify({upload: req.upload})));
      }
    });
  }

  public async put(req: Request, res: Response, next: NextFunction) {
    if (req.upload.author.id.toString() === req.user.id.toString()) {
      _.assign(req.upload, _.omit(req.body, UploadController.RESERVED_FIELDS));
      const upload = await req.upload.save();
      res.json(upload);
    }
  }

  public async delete(req: Request, res: Response, next: NextFunction) {
    await req.upload.remove();
    res.sendStatus(httpStatus.NO_CONTENT);
  }

  public async create(req: Request, res: Response, next: NextFunction) {
    res.format({
      html: function () {
        res.render("upload/create");
      },
    });
  }
}
