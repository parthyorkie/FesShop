import { Server, Socket } from "socket.io";

import { logger } from "../utils/logger";
import { getCounter } from "../services/counter.service";
import { COUNTER_EVENTS } from "./counter.events";
import { CounterPayload } from "./counter.types";

export const registerCounterSocket = (
    _io: Server,
    socket: Socket
): void => {

    socket.on(COUNTER_EVENTS.GET_LATEST, () => {

        logger.info(
            `Latest counter requested by ${socket.id}`
        );

        const payload: CounterPayload = {
            value: getCounter(),
        };

        socket.emit(
            COUNTER_EVENTS.LATEST,
            payload
        );

    });

};