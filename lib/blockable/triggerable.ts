export default interface Triggerable<T> {
    isTriggered(data: T): boolean;
}