function typeInTextarea(newText, el = document.activeElement) {
    const [start, end] = [el.selectionStart, el.selectionEnd];
    console.log(start, end);
    el.setRangeText(newText, end, end, 'select');
  }
