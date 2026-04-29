/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

module.exports = class Status {
  constructor(rawStatus) {
    // The message ID that this status update refers to
    this.messageId = rawStatus.id;

    // The delivery status (sent, delivered, read, failed, etc.)
    this.status = rawStatus.status;

    // The recipient's phone number
    this.recipientPhoneNumber = rawStatus.recipient_id;
  }
};
