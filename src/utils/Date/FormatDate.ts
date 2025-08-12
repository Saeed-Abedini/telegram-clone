const formatDate = (inputDate: string) => {
  if (!inputDate) return "";

  const dateObj = new Date(inputDate);
  if (isNaN(dateObj.getTime())) return "";

  const now = new Date();

  if (dateObj.toDateString() === now.toDateString()) {
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (dateObj >= sevenDaysAgo && dateObj < now) {
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return daysOfWeek[dateObj.getDay()];
  }

  if (dateObj.getFullYear() === now.getFullYear()) {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const day = dateObj.getDate();
    const month = months[dateObj.getMonth()];
    return `${day} ${month}`;
  }

  const day = String(dateObj.getDate()).padStart(2, "0");
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const year = String(dateObj.getFullYear()).slice(-2);
  return `${day}.${month}.${year}`;
};

export default formatDate;
