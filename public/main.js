/* global document */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const datasourcesButton = document.querySelector('#datasourcesButton');
  datasourcesButton.addEventListener('click', () => {
    const datasources = document.querySelector('.datasources');
    datasources.classList.toggle('hidden');
    datasourcesButton.classList.toggle('active');
  });
});