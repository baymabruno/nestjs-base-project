import { Logger } from '@nestjs/common';

// the services log each sync and failure; the tests check the results instead
Logger.overrideLogger(false);
