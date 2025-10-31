/**
 * 
 * @param {*} id 
 * @returns HTMLElement
 */
const $ = (id) => document.getElementById(id);

/**
 * 
 * @returns NodeListOf<Element>
 */
const pages = () => document.querySelectorAll(".page");

export const dom = {
    $,
    pages
}

