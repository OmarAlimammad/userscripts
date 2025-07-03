// ==UserScript==
// @name         Codeforces Show Problem Rating
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Show problem rating directly on the problem page
// @author       nobody
// @match        https://codeforces.com/problemset/problem/*
// @match        https://codeforces.com/contest/*/problem/*
// @match        https://codeforces.com/gym/*/problem/*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const getProblemInfo = () => {
        const urlParts = window.location.pathname.split('/');
        const isProblemset = urlParts[1] === 'problemset';
        const isContest = urlParts[1] === 'contest';
        const isGym = urlParts[1] === 'gym';

        let contestId, index;

        if (isProblemset) {
            contestId = urlParts[3];
            index = urlParts[4];
        } else if (isContest || isGym) {
            contestId = urlParts[2];
            index = urlParts[4];
        }

        return { contestId, index };
    };

    const injectRating = async () => {
        const { contestId, index } = getProblemInfo();

        if (!contestId || !index) return;

        const apiUrl = `https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`;

        try {
            const response = await fetch(apiUrl);
            const data = await response.json();

            if (data.status !== 'OK') return;

            const problems = data.result.problems;
            const problem = problems.find(p => p.index === index);

            if (!problem || !problem.rating) return;

            const ratingSpan = document.createElement('span');
            ratingSpan.textContent = `(${problem.rating})`;
            ratingSpan.style.marginLeft = '10px';
            ratingSpan.style.fontSize = '16px';
            ratingSpan.style.color = '#888';

            const titleDiv = document.querySelector('.title');
            if (titleDiv) {
                titleDiv.appendChild(ratingSpan);
            }

        } catch (e) {
            console.error('Failed to fetch problem rating:', e);
        }
    };

    injectRating();
})();
