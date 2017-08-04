import express from 'express';
import logger from 'morgan';
import bodyParser from 'body-parser';
import routes from './routes';
import mongoose from 'mongoose';
import httpStatus from 'http-status';

const {MONGO_URL = 'mongodb://localhost/larry'} = process.env;


const app = express();
app.disable('x-powered-by');

app.use(logger('dev', {
  skip: () => app.get('env') === 'test'
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// Database
mongoose.Promise = global.Promise;
mongoose.connect(MONGO_URL, {
  useMongoClient: true,
});

// Routes
app.use('/', routes);

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// Error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  res.status(err.status || httpStatus.INTERNAL_SERVER_ERROR);
  res.json({
    errors: [
      {
        message: err.message
      }
    ]
  });
});

export default app;
